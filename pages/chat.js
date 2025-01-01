import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import styles from '../styles/Chat.module.css';

export default function Chat() {
  const { isLoggedIn, user, loading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push('/'); // Redirect to home if not logged in
    }
  }, [isLoggedIn, loading, router]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchMessages();

      const messageListener = supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
          const newMessage = payload.new;
          const { data: userData, error } = await supabase
            .from('users')
            .select('username, is_admin')
            .eq('id', newMessage.user_id)
            .single();

          if (!error) {
            newMessage.users = userData;
          } else {
            newMessage.users = { username: 'Unknown', is_admin: false };
          }

          setMessages(prevMessages => [...prevMessages, newMessage]);
        })
        .subscribe();

      const roomOne = supabase.channel('room_01', {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      roomOne
        .on('presence', { event: 'sync' }, () => {
          const newState = roomOne.presenceState();
          const onlineUsernames = Object.values(newState).flat().map(presence => presence.user);
          setOnlineUsers(onlineUsernames);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          setOnlineUsers(prevUsers => [...prevUsers, ...newPresences.map(presence => presence.user)]);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          setOnlineUsers(prevUsers => prevUsers.filter(user => !leftPresences.some(presence => presence.user === user)));
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return;

          const presenceTrackStatus = await roomOne.track({
            user: user.username,
            online_at: new Date().toISOString(),
          });
          console.log(presenceTrackStatus);
        });

      return () => {
        supabase.removeChannel(messageListener);
        roomOne.unsubscribe();
      };
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, users(username, is_admin)')
      .order('created_at', { ascending: true });

    if (!error) {
      setMessages(data);
    } else {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Error fetching user:', userError);
        return;
      }

      const { error } = await supabase
        .from('messages')
        .insert([{ user_id: user.id, content: newMessage }]);

      if (!error) {
        setNewMessage('');
      } else {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header />
      <div className={styles.container}>
        <div className={styles.chatContainer}>
          <div className={styles.messages}>
            {messages.map((message, index) => (
              <div key={index} className={styles.messageContainer}>
                {user && message.users?.username !== user.username && (
                  <div className={styles.messageHeader}>
                    <strong>
                      {message.users?.username || 'Unknown'}
                      {message.users?.is_admin && <span className={styles.adminBadge}> (Admin)</span>}
                    </strong>
                  </div>
                )}
                <div
                  className={`${styles.message} ${user && message.users?.username === user.username ? styles.myMessage : styles.otherMessage} ${message.users?.is_admin ? styles.adminMessage : ''}`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className={styles.inputContainer}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
            />
            <button onClick={handleSendMessage}>Send</button>
          </div>
        </div>
        <div className={styles.onlineUsers}>
          <h3>Online Users</h3>
          <ul className={styles.onlineUsersList}>
            {onlineUsers.map((user, index) => (
              <li key={index}>{user}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
