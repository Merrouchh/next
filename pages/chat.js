import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { debounce } from 'lodash';
import { useRouter } from 'next/router';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Chat.module.css';
import { formatDistanceToNow } from 'date-fns';
import { FaSmile } from 'react-icons/fa';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
const supabase = createClient();

class ChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chat Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <h2>Something went wrong with the chat.</h2>
          <button onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Chat() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const messagesEndRef = useRef(null);
  const { isLoggedIn, user, loading } = useAuth();
  const router = useRouter();

  const handleTyping = useCallback(debounce(async () => {
    if (!user?.username) return;
    await supabase
      .from('typing')
      .upsert(
        { user_id: user.id, username: user.username },
        { onConflict: 'user_id' }
      );
  }, 500), [user]);

  useEffect(() => {
    if (!isLoggedIn && !loading) {
      router.push('/');
      return;
    }

    if (!user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(id, username, is_admin)')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    const messageChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
      async payload => {
        const { data: newMessage, error } = await supabase
          .from('messages')
          .select('*, users(id, username, is_admin)')
          .eq('id', payload.new.id)
          .single();

        if (!error && newMessage) {
          setMessages(prev => [...prev, newMessage]);
          scrollToBottom();
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel('room_01', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineUserIds = Object.keys(state).map(key => state[key][0].user_id);
        setOnlineUsers(onlineUserIds);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers(prev => {
          const updatedUsers = [...prev, ...newPresences.map(presence => presence.user_id)];
          return updatedUsers;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setOnlineUsers(prev => {
          const updatedUsers = prev.filter(userId => !leftPresences.some(presence => presence.user_id === userId));
          return updatedUsers;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            username: user.username,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [isLoggedIn, loading, user, router]);

  useEffect(() => {
    const chatContainer = document.querySelector(`.${styles.chatContainer}`);
    if (chatContainer) {
      const handleTouchStart = () => {
        chatContainer.focus();
      };

      chatContainer.addEventListener('touchstart', handleTouchStart);

      return () => {
        chatContainer.removeEventListener('touchstart', handleTouchStart);
      };
    }
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const { error } = await supabase
      .from('messages')
      .insert([{ user_id: user.id, content: newMessage }]);

    if (!error) {
      setNewMessage('');
      setShowEmojis(false);
    }
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    setCharCount(e.target.value.length);
    handleTyping();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (loading) return <div className={styles.loadingContainer}>Loading...</div>;

  return (
    <div className={styles.chatWrapper}>
      <div className={styles.chatContainer}>
        {/* Main chat area */}
        <main className={styles.messages}>
          <div className={styles.messagesScroll}>
            {messages.map((message, index) => (
              <div 
                key={message.id || index}
                className={`${styles.messageContainer} ${
                  message.users?.username === user.username ? styles.sent : styles.received
                }`}
              >
                <span className={styles.username}>
                  {message.users?.username || 'Unknown'}
                  {message.users?.is_admin && ' 🛡️'}
                  <span className={`${styles.statusDot} ${onlineUsers.includes(message.users?.id) ? styles.online : styles.offline}`}></span>
                </span>
                <div className={styles.messageContent}>
                  {message.content}
                </div>
                <div className={styles.timestampContainer}>
                  <span className={styles.timestamp}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input container for typing and sending messages */}
          <div className={styles.inputContainer}>
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              maxLength={255}
            />
            <span className={styles.charCounter}>{charCount}/255</span>
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SafeChat() {
  return (
    <ChatErrorBoundary>
      <Chat />
    </ChatErrorBoundary>
  );
}