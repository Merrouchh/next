package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"voicechat/supabase"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// Room represents a chat room
type Room struct {
	ID      string
	Clients map[*Client]bool
	mu      sync.Mutex
}

// Client represents a connected user
type Client struct {
	Conn     *websocket.Conn
	Room     *Room
	ID       string
	Username string
	Device   string
	connMu   sync.Mutex
}

// Message represents WebSocket messages
type Message struct {
	Type    string      `json:"type"`
	RoomID  string      `json:"roomId,omitempty"`
	From    string      `json:"from,omitempty"`
	To      string      `json:"to,omitempty"`
	Content interface{} `json:"content,omitempty"`
}

var (
	rooms    = make(map[string]*Room)
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for demo
		},
	}
	roomsMutex sync.Mutex
)

func init() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found")
	}
}

func createRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RoomID string `json:"roomId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	roomsMutex.Lock()
	if _, exists := rooms[req.RoomID]; exists {
		roomsMutex.Unlock()
		http.Error(w, "Room already exists", http.StatusConflict)
		return
	}

	rooms[req.RoomID] = &Room{
		ID:      req.RoomID,
		Clients: make(map[*Client]bool),
	}
	roomsMutex.Unlock()

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"roomId": req.RoomID})
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Get parameters first
	roomID := r.URL.Query().Get("roomId")
	username := r.URL.Query().Get("username")
	device := r.URL.Query().Get("device")

	// Create done channel for cleanup
	done := make(chan struct{})
	defer close(done)

	// Set up WebSocket with no timeouts
	conn.SetReadDeadline(time.Time{})
	conn.SetWriteDeadline(time.Time{})

	roomsMutex.Lock()
	room, exists := rooms[roomID]
	if !exists {
		room = &Room{
			ID:      roomID,
			Clients: make(map[*Client]bool),
		}
		rooms[roomID] = room
	}
	roomsMutex.Unlock()

	// Create the client
	client := &Client{
		Conn:     conn,
		Room:     room,
		ID:       uuid.New().String(),
		Username: username,
		Device:   device,
	}

	// Set up ping/pong handlers with access to username and client
	conn.SetPingHandler(func(data string) error {
		// Reset read deadline on ping
		conn.SetReadDeadline(time.Time{})
		err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(time.Second*5))
		if err != nil {
			log.Printf("Error sending pong to %s: %v", username, err)
		}
		return nil
	})

	conn.SetPongHandler(func(string) error {
		// Reset read deadline on pong
		conn.SetReadDeadline(time.Time{})
		return nil
	})

	// Start ping sender after client is created
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				client.connMu.Lock()
				err := conn.WriteControl(
					websocket.PingMessage,
					[]byte{},
					time.Now().Add(time.Second*5),
				)
				client.connMu.Unlock()
				if err != nil {
					if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
						log.Printf("Ping error for %s: %v", username, err)
					}
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Then check if user already exists in room
	room.mu.Lock()
	for existingClient := range room.Clients {
		if existingClient.ID == client.ID {
			room.mu.Unlock()
			log.Printf("User %s already in room %s, closing new connection", username, roomID)
			conn.Close()
			return
		}
	}
	room.mu.Unlock()

	// Add user to Supabase first
	err = supabase.AddUserToRoom(roomID, client.ID, username, device)
	if err != nil {
		log.Printf("Error adding user to Supabase: %v", err)
		conn.Close()
		return
	}

	// Get existing users from Supabase
	dbUsers, err := supabase.GetRoomUsers(roomID)
	if err != nil {
		log.Printf("Error getting users from Supabase: %v", err)
		conn.Close()
		return
	}

	// Send welcome message
	welcomeMsg := Message{
		Type: "welcome",
		From: "system",
		Content: map[string]interface{}{
			"userId": client.ID,
			"roomId": roomID,
		},
	}
	if err := client.WriteJSON(welcomeMsg); err != nil {
		log.Printf("Error sending welcome message: %v", err)
		return
	}

	// Send existing users list only once at connection
	existingUsers := []map[string]string{}
	for _, user := range dbUsers {
		if user.UserID != client.ID {
			existingUsers = append(existingUsers, map[string]string{
				"userId":   user.UserID,
				"username": user.Username,
				"device":   user.Device,
			})
		}
	}

	if len(existingUsers) > 0 {
		existingUsersMsg := Message{
			Type:    "existing-users",
			From:    "system",
			Content: existingUsers,
		}
		if err := client.WriteJSON(existingUsersMsg); err != nil {
			log.Printf("Error sending existing users: %v", err)
			return
		}
	}

	// Add client to room
	room.mu.Lock()
	room.Clients[client] = true
	room.mu.Unlock()

	// Notify others about new user
	broadcastToRoom(room, Message{
		Type: "user-joined",
		From: client.Username,
		Content: map[string]string{
			"userId":   client.ID,
			"username": client.Username,
			"device":   client.Device,
		},
	}, client)

	// Update last seen less frequently
	lastSeenTicker := time.NewTicker(10 * time.Minute) // Change to 10 minutes
	defer lastSeenTicker.Stop()

	go func() {
		for {
			select {
			case <-lastSeenTicker.C:
				if err := supabase.UpdateUserLastSeen(roomID, client.ID); err != nil {
					log.Printf("Error updating last seen: %v", err)
				}
			case <-done:
				return
			}
		}
	}()

	// Handle messages
	handleMessages(client)
}

func handleMessages(client *Client) {
	defer func() {
		// Always clean up regardless of close reason
		if err := supabase.RemoveUserFromRoom(client.Room.ID, client.ID); err != nil {
			log.Printf("Error removing user from Supabase: %v", err)
		}

		client.Room.mu.Lock()
		delete(client.Room.Clients, client)
		client.Room.mu.Unlock()

		broadcastToRoom(client.Room, Message{
			Type: "user-left",
			From: client.Username,
			Content: map[string]string{
				"userId":   client.ID,
				"username": client.Username,
			},
		}, client)

		client.Conn.Close()
	}()

	for {
		var msg Message
		err := client.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("DEBUG: Error reading message from %s: %v", client.Username, err)
			}
			break
		}

		msg.From = client.ID
		log.Printf("DEBUG: Received message type %s from %s", msg.Type, client.Username)

		switch msg.Type {
		case "get-users":
			users, err := supabase.GetRoomUsers(client.Room.ID)
			if err != nil {
				log.Printf("Error getting users: %v", err)
				continue
			}

			// Only send users that are actually connected
			activeUsers := []map[string]string{}
			client.Room.mu.Lock()
			for _, user := range users {
				// Check if user is still connected
				isConnected := false
				for c := range client.Room.Clients {
					if c.ID == user.UserID {
						isConnected = true
						break
					}
				}
				if isConnected && user.UserID != client.ID {
					activeUsers = append(activeUsers, map[string]string{
						"userId":   user.UserID,
						"username": user.Username,
						"device":   user.Device,
					})
				}
			}
			client.Room.mu.Unlock()

			existingUsersMsg := Message{
				Type:    "existing-users",
				From:    "system",
				Content: activeUsers,
			}

			if err := client.WriteJSON(existingUsersMsg); err != nil {
				log.Printf("Error sending existing users: %v", err)
			}

		case "offer", "answer", "ice-candidate":
			forwardToClient(client.Room, msg)
		case "keep-alive":
			// Just acknowledge the keep-alive
			if err := client.WriteJSON(Message{
				Type: "keep-alive-ack",
				From: "system",
			}); err != nil {
				log.Printf("Error sending keep-alive ack: %v", err)
			}
		}
	}
}

func broadcastToRoom(room *Room, msg Message, exclude *Client) {
	room.mu.Lock()
	defer room.mu.Unlock()

	for client := range room.Clients {
		if client != exclude {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Printf("Error broadcasting to client: %v", err)
			}
		}
	}
}

func forwardToClient(room *Room, msg Message) {
	room.mu.Lock()
	defer room.mu.Unlock()

	for client := range room.Clients {
		if client.ID == msg.To {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Printf("Error forwarding message: %v", err)
			}
			break
		}
	}
}

func (c *Client) WriteJSON(msg interface{}) error {
	c.connMu.Lock()
	defer c.connMu.Unlock()
	return c.Conn.WriteJSON(msg)
}

func testSupabase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Printf("Testing Supabase connection...")
	testResults := make(map[string]interface{})

	// 1. Test adding a user
	testRoom := "test-room-" + time.Now().Format("150405")
	testUser := "test-user-" + time.Now().Format("150405")

	log.Printf("1. Adding test user %s to room %s", testUser, testRoom)
	err := supabase.AddUserToRoom(testRoom, testUser, "Test User", "Test Device")
	if err != nil {
		log.Printf("Error adding user: %v", err)
		http.Error(w, fmt.Sprintf("Error adding user: %v", err), http.StatusInternalServerError)
		return
	}
	testResults["add_user"] = "success"

	// 2. Get users in the room
	log.Printf("2. Getting users for room %s", testRoom)
	users, err := supabase.GetRoomUsers(testRoom)
	if err != nil {
		log.Printf("Error getting users: %v", err)
		http.Error(w, fmt.Sprintf("Error getting users: %v", err), http.StatusInternalServerError)
		return
	}
	testResults["get_users"] = users
	log.Printf("Found %d users in room %s", len(users), testRoom)

	// 3. Test updating last seen
	log.Printf("3. Updating last seen for user %s", testUser)
	err = supabase.UpdateUserLastSeen(testRoom, testUser)
	if err != nil {
		log.Printf("Error updating last seen: %v", err)
		testResults["update_last_seen"] = fmt.Sprintf("error: %v", err)
	} else {
		testResults["update_last_seen"] = "success"
	}

	// 4. Test removing user
	log.Printf("4. Removing user %s from room %s", testUser, testRoom)
	err = supabase.RemoveUserFromRoom(testRoom, testUser)
	if err != nil {
		log.Printf("Error removing user: %v", err)
		testResults["remove_user"] = fmt.Sprintf("error: %v", err)
	} else {
		testResults["remove_user"] = "success"
	}

	// 5. Verify user was removed by checking active users
	log.Printf("5. Verifying user removal")
	usersAfterRemoval, err := supabase.GetRoomUsers(testRoom)
	if err != nil {
		log.Printf("Error getting users after removal: %v", err)
		testResults["verify_removal"] = fmt.Sprintf("error: %v", err)
	} else {
		testResults["verify_removal"] = map[string]interface{}{
			"active_users_count": len(usersAfterRemoval),
			"expected_count":     0,
		}
	}

	// Return the test results as JSON
	w.Header().Set("Content-Type", "application/json")
	response := map[string]interface{}{
		"message": "Test completed successfully",
		"room":    testRoom,
		"results": testResults,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

func main() {
	// Initialize Supabase client
	if err := supabase.InitSupabase(); err != nil {
		log.Fatalf("Failed to initialize Supabase: %v", err)
	}

	// Create static file server
	fs := http.FileServer(http.Dir("static"))

	// Serve static files
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "index.html")
			return
		}
		// Remove /static prefix before serving
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/static")
		fs.ServeHTTP(w, r)
	})

	// Add CORS middleware
	corsMiddleware := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next(w, r)
		}
	}

	// Update your handlers with CORS
	http.HandleFunc("/api/room", corsMiddleware(createRoom))
	http.HandleFunc("/ws/voicechat", corsMiddleware(handleWebSocket))
	http.HandleFunc("/test-supabase", corsMiddleware(testSupabase))

	port := ":8080"
	fmt.Printf("Server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
