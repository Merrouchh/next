package supabase

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/nedpals/supabase-go"
)

type RoomUser struct {
	ID       string    `json:"id"`
	RoomID   string    `json:"room_id"`
	UserID   string    `json:"user_id"`
	Username string    `json:"username"`
	Device   string    `json:"device"`
	JoinedAt time.Time `json:"joined_at,omitempty"`
	LastSeen time.Time `json:"last_seen,omitempty"`
	IsActive bool      `json:"is_active"`
}

type RoomUserState struct {
	IsActive     bool      `json:"is_active"`
	LastSeen     time.Time `json:"last_seen"`
	ConnectionID string    `json:"connection_id"`
}

var client *supabase.Client

func InitSupabase() error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		return fmt.Errorf("SUPABASE_URL and SUPABASE_KEY must be set")
	}

	client = supabase.CreateClient(supabaseURL, supabaseKey)
	return nil
}

func GetUserInRoom(roomID, userID string) (*RoomUser, error) {
	log.Printf("Checking if user %s exists in room %s", userID, roomID)

	var users []RoomUser
	err := client.DB.From("room_users").
		Select("*").
		Eq("room_id", roomID).
		Eq("user_id", userID).
		Execute(&users)

	if err != nil {
		return nil, fmt.Errorf("failed to check user in room: %w", err)
	}

	if len(users) == 0 {
		return nil, nil
	}

	return &users[0], nil
}

func ReactivateUserInRoom(roomID, userID string) error {
	log.Printf("Reactivating user %s in room %s", userID, roomID)

	// First cleanup any existing connections
	err := CleanupUserConnections(roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to cleanup existing connections: %w", err)
	}

	// Generate new connection ID
	connectionID := uuid.New().String()

	// Update with new connection
	err = UpdateUserConnection(roomID, userID, connectionID)
	if err != nil {
		return fmt.Errorf("failed to reactivate user: %w", err)
	}

	return nil
}

func AddUserToRoom(roomID, userID, username, device string) error {
	log.Printf("Adding user to room: %s (User: %s, Device: %s)", roomID, username, device)

	// Check if user already exists in the room
	existingUser, err := GetUserInRoom(roomID, userID)
	if err != nil {
		return fmt.Errorf("failed to check existing user: %w", err)
	}

	// If user exists but is inactive, reactivate them
	if existingUser != nil {
		if !existingUser.IsActive {
			return ReactivateUserInRoom(roomID, userID)
		}
		// User is already active in the room
		return nil
	}

	// Create new user if they don't exist
	user := RoomUser{
		ID:       uuid.New().String(),
		RoomID:   roomID,
		UserID:   userID,
		Username: username,
		Device:   device,
		IsActive: true,
		JoinedAt: time.Now(),
		LastSeen: time.Now(),
	}

	var result []RoomUser
	err = client.DB.From("room_users").Insert(user).Execute(&result)
	if err != nil {
		log.Printf("Error adding user to room: %v", err)
		return fmt.Errorf("failed to add user to room: %w", err)
	}

	log.Printf("Successfully added user %s to room %s", username, roomID)
	return nil
}

func GetRoomUsers(roomID string) ([]RoomUser, error) {
	log.Printf("Getting users for room: %s", roomID)

	var users []RoomUser
	err := client.DB.From("room_users").
		Select("*").
		Eq("room_id", roomID).
		Eq("is_active", "true").
		Execute(&users)

	if err != nil {
		log.Printf("Error getting room users: %v", err)
		return nil, fmt.Errorf("failed to get room users: %w", err)
	}

	log.Printf("Found %d active users in room %s", len(users), roomID)
	return users, nil
}

func RemoveUserFromRoom(roomID, userID string) error {
	log.Printf("Removing user %s from room %s", userID, roomID)
	return CleanupUserConnections(roomID, userID)
}

func UpdateUserLastSeen(roomID, userID string) error {
	updates := map[string]interface{}{
		"last_seen": time.Now(),
	}

	var result []RoomUser
	err := client.DB.From("room_users").
		Update(updates).
		Eq("room_id", roomID).
		Eq("user_id", userID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to update user last seen: %w", err)
	}

	if len(result) == 0 {
		return fmt.Errorf("no user was updated")
	}

	return nil
}

func CleanupUserConnections(roomID, userID string) error {
	log.Printf("Cleaning up connections for user %s in room %s", userID, roomID)

	updates := map[string]interface{}{
		"is_active":     false,
		"last_seen":     time.Now(),
		"connection_id": nil,
	}

	var result []RoomUser
	err := client.DB.From("room_users").
		Update(updates).
		Eq("room_id", roomID).
		Eq("user_id", userID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to cleanup user connections: %w", err)
	}

	return nil
}

func UpdateUserConnection(roomID, userID, connectionID string) error {
	log.Printf("Updating connection for user %s in room %s", userID, roomID)

	updates := map[string]interface{}{
		"is_active":     true,
		"last_seen":     time.Now(),
		"connection_id": connectionID,
	}

	var result []RoomUser
	err := client.DB.From("room_users").
		Update(updates).
		Eq("room_id", roomID).
		Eq("user_id", userID).
		Execute(&result)

	if err != nil {
		return fmt.Errorf("failed to update user connection: %w", err)
	}

	return nil
}
