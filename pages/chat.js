import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Chat.module.css';
import Head from 'next/head';

const supabase = createClient();
const MAX_MESSAGE_LENGTH = 255;

export default function Chat() {
  const { isLoggedIn, user: currentUser } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastMessageDate = useRef(null);
  const MESSAGES_PER_LOAD = 30;
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Update scroll behavior
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    // Only auto-scroll if user is already at bottom or it's the initial load
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      
      if (isAtBottom) {
        scrollToBottom();
      }
    }
  }, [messages]);

  // Handle scroll with throttling
  const handleScroll = (e) => {
    const container = e.target;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom) {
      setHasNewMessages(false);
    }

    // Check if scrolled near top for loading older messages
    if (container.scrollTop < 50 && !isLoading && hasMore) {
      loadOlderMessages();
    }
  };

  // Handle sending message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || newMessage.length > MAX_MESSAGE_LENGTH) return;

    try {
      await supabase
        .from('messages')
        .insert([{ 
          user_id: currentUser.id, 
          content: newMessage.trim() 
        }]);

      setNewMessage('');
      scrollToBottom(); // Add scroll after sending
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Add function to load older messages
  const loadOlderMessages = async () => {
    if (isLoading || !hasMore) return;
    
    try {
      setIsLoading(true);
      const oldestMessageDate = lastMessageDate.current || new Date().toISOString();
      
      // Store current scroll position
      const container = messagesContainerRef.current;
      const previousScrollHeight = container?.scrollHeight;
      
      // Add artificial delay
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(username, is_admin)')
        .lt('created_at', oldestMessageDate)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_LOAD);

      if (error) throw error;

      if (data.length < MESSAGES_PER_LOAD) {
        setHasMore(false);
      }

      if (data.length > 0) {
        lastMessageDate.current = data[data.length - 1].created_at;
        setMessages(prev => [...data.reverse(), ...prev]);
        
        // Maintain scroll position after new messages are added
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - previousScrollHeight;
          }
        }, 0);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      // Add small delay before hiding loading indicator
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  // Initialize chat and subscriptions
  useEffect(() => {
    if (!currentUser) return;

    let messageSubscription;
    let presenceSubscription;

    const initChat = async () => {
      try {
        // Fetch initial messages
        const { data: messages } = await supabase
          .from('messages')
          .select('*, users(username, is_admin)')
          .order('created_at', { ascending: false })
          .limit(MESSAGES_PER_LOAD);

        if (messages) {
          const reversedMessages = messages.reverse();
          setMessages(reversedMessages);
          if (messages.length > 0) {
            lastMessageDate.current = messages[0].created_at;
          }
          // Focus chat and scroll to bottom after small delay
          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.focus();
              scrollToBottom();
            }
          }, 100);
        }

        // Subscribe to new messages
        messageSubscription = supabase
          .channel('messages')
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
          }, async (payload) => {
            const { data: userData } = await supabase
              .from('users')
              .select('username, is_admin')
              .eq('id', payload.new.user_id)
              .single();

            const newMessage = {
              ...payload.new,
              users: userData
            };

            setMessages(prev => [...prev, newMessage]);
            
            const isScrolledUp = messagesContainerRef.current && 
              (messagesContainerRef.current.scrollHeight - messagesContainerRef.current.scrollTop - 
               messagesContainerRef.current.clientHeight > 100);

            if (isScrolledUp) {
              setHasNewMessages(true);
            } else {
              scrollToBottom();
            }
          })
          .subscribe();

        // Subscribe to presence
        presenceSubscription = supabase.channel('online-users');
        
        presenceSubscription
          .on('presence', { event: 'sync' }, () => {
            const presenceState = presenceSubscription.presenceState();
            const users = Object.values(presenceState).flat();
            setOnlineUsers(users.map(u => u.username));
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceSubscription.track({
                username: currentUser.username,
                online_at: new Date().toISOString(),
              });
            }
          });
      } catch (error) {
        console.error('Chat initialization error:', error);
      }
    };

    initChat();
    return () => {
      messageSubscription?.unsubscribe();
      presenceSubscription?.unsubscribe();
    };
  }, [currentUser]);

  const formatMessageContent = (content) => {
    // Updated regex to match URLs with or without protocol
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])|(?<![/.])(\b(?:www\.)?[a-zA-Z0-9-]+\.(?:com|net|org|edu|gov|mil|io|co|uk|de|ru|fr|it|es|nl|se|no|fi|dk|pl|ch|at|be|ie|pt|gr|hu|cz|sk|ro|bg|hr|rs|ua|by|lt|lv|ee|md|am|az|ge|kz|uz|tm|kg|tj)[^\s<]*[^<.,:;"')\]\s])/gi;
    
    const parts = content.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part && part.match(urlRegex)) {
        try {
          // Add https:// if protocol is missing
          const url = part.startsWith('http') ? part : `https://${part}`;
          return (
            <a 
              key={index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.messageLink}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {part}
            </a>
          );
        } catch {
          return part;
        }
      }
      return part;
    }).filter(Boolean); // Remove null/undefined values
  };

  const formatMessageTime = (timestamp) => {
    const messageDate = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = messageDate.toDateString() === now.toDateString();
    const isYesterday = messageDate.toDateString() === yesterday.toDateString();
    
    const time = messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });

    if (isToday) {
      return `Today at ${time}`;
    } else if (isYesterday) {
      return `Yesterday at ${time}`;
    } else if (now.getFullYear() === messageDate.getFullYear()) {
      // Same year, show date without year
      return messageDate.toLocaleDateString([], {
        month: 'short',
        day: 'numeric'
      }) + ` at ${time}`;
    } else {
      // Different year, show full date
      return messageDate.toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) + ` at ${time}`;
    }
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <Head>
        <title>Chat Room</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className={styles.chatWrapper}>
        <main className={styles.container}>
          <div className={styles.chatContainer}>
            <button 
              className={styles.onlineUsersToggle}
              onClick={() => setShowOnlineUsers(prev => !prev)}
            >
              <span className={styles.onlineCount}>{onlineUsers.length}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.userIcon}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </button>

            <div 
              ref={messagesContainerRef}
              className={styles.messages} 
              onScroll={handleScroll}
              tabIndex={0} // Make container focusable
            >
              {/* Loading indicator */}
              {isLoading && (
                <div className={styles.loadingMore}>
                  Loading more messages...
                </div>
              )}
              
              {messages.map((message) => (
                <div key={message.id} className={styles.messageContainer}>
                  {message.users?.username !== currentUser?.username && (
                    <div className={styles.messageHeader}>
                      <strong>{message.users?.username || 'Unknown'}</strong>
                    </div>
                  )}
                  <div className={`${styles.message} ${
                    message.users?.username === currentUser?.username 
                      ? styles.myMessage 
                      : styles.otherMessage
                  }`}>
                    <div className={styles.messageContent}>
                      {formatMessageContent(message.content)}
                    </div>
                    <span className={styles.messageTime}>
                      {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              
              {hasNewMessages && (
                <button 
                  className={styles.newMessagesNotif}
                  onClick={scrollToBottom}
                >
                  New messages ↓
                </button>
              )}
            </div>

            <form className={styles.inputContainer} onSubmit={handleSendMessage}>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                      setNewMessage(e.target.value);
                    }
                  }}
                  placeholder="Type your message..."
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <span className={styles.charCount}>
                  {newMessage.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
              <button 
                type="submit"
                disabled={!newMessage.trim()}
              >
                Send
              </button>
            </form>
          </div>

          {showOnlineUsers && (
            <>
              <div className={`${styles.onlineUsersDrawer} ${showOnlineUsers ? styles.show : ''}`}>
                <div className={styles.drawerHeader}>
                  <h3>Online Users ({onlineUsers.length})</h3>
                  <button onClick={() => setShowOnlineUsers(false)}>×</button>
                </div>
                <ul className={styles.onlineUsersList}>
                  {onlineUsers.map((username, index) => (
                    <li key={index}>{username}</li>
                  ))}
                </ul>
              </div>
              <div 
                className={styles.backdrop}
                onClick={() => setShowOnlineUsers(false)}
              />
            </>
          )}
        </main>
      </div>
    </>
  );
}
