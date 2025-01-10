import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/Chat.module.css';
import Head from 'next/head';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import dynamic from 'next/dynamic';
import { getSupabaseClient } from '../utils/supabase/client';
import ImageModal from '../components/ImageModal';
import UploadProgressBar from '../components/UploadProgressBar';
import MediaUploadDialog from '../components/MediaUploadDialog';

const supabase = getSupabaseClient();
const MAX_MESSAGE_LENGTH = 255;

// Initialize FFmpeg at module level
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

let ffmpeg = null;
let isFFmpegLoaded = false;

// Initialize FFmpeg function
const initFFmpeg = async () => {
  if (typeof window === 'undefined') return null;
  
  try {
    if (!ffmpeg) {
      ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        wasmPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm',
        mainName: 'main',
        threads: 1, // Disable multi-threading to avoid errors
        logger: ({ message }) => console.log('FFmpeg Log:', message),
        progress: ({ ratio }) => console.log('FFmpeg Progress:', ratio)
      });
    }

    if (!isFFmpegLoaded) {
      await ffmpeg.load();
      isFFmpegLoaded = true;
      console.log('FFmpeg loaded successfully');
    }

    return ffmpeg;
  } catch (error) {
    console.error('FFmpeg initialization failed:', error);
    return null;
  }
};

const compressImage = async (file) => {
  try {
    console.log('Starting image compression...');
    console.log('Original image size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    const options = {
      maxSizeMB: 0.5,           // Reduce max size to 500KB
      maxWidthOrHeight: 1024,   // Limit max width/height to 1024px
      useWebWorker: true,
      fileType: file.type,
      initialQuality: 0.8,      // Start with good quality
      alwaysKeepResolution: false, // Allow resizing if needed
      preserveExif: false,      // Remove EXIF data to reduce size
    };

    // If image is already small, use lighter compression
    if (file.size < 1024 * 1024) { // Less than 1MB
      options.maxSizeMB = 0.3;
      options.initialQuality = 0.85;
    }

    const compressedFile = await imageCompression(file, options);
    console.log('Compressed image size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file; // Return original file if compression fails
  }
};

const getFileBlob = async (file) => {
  const response = await fetch(URL.createObjectURL(file));
  const data = await response.blob();
  return data;
};

// Update compressVideo function with faster settings
const compressVideo = async (file, setCompressionProgress) => {
  try {
    const ffmpegInstance = await initFFmpeg();
    if (!ffmpegInstance) throw new Error('FFmpeg not initialized');

    setCompressionProgress(30);
    console.log('Starting video compression...');

    // Convert file to buffer
    const fileData = await fetchFile(file);
    ffmpegInstance.FS('writeFile', 'input.mp4', fileData);
    
    setCompressionProgress(50);

    // More stable FFmpeg command with simplified settings
    await ffmpegInstance.run(
      '-i', 'input.mp4',
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Change to ultrafast for better stability
      '-tune', 'fastdecode',
      '-crf', '30',
      '-vf', 'scale=640:-2', // Reduced resolution
      '-threads', '1',        // Single thread
      '-movflags', '+faststart',
      '-c:a', 'aac',
      '-b:a', '64k',         // Reduced audio bitrate
      '-y',                  // Overwrite output
      'output.mp4'
    );

    setCompressionProgress(80);

    // Read the compressed file
    const data = ffmpegInstance.FS('readFile', 'output.mp4');
    const compressedVideo = new Blob([data.buffer], { type: 'video/mp4' });
    
    // Clean up
    try {
      ffmpegInstance.FS('unlink', 'input.mp4');
      ffmpegInstance.FS('unlink', 'output.mp4');
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }

    setCompressionProgress(100);
    
    return compressedVideo;
  } catch (error) {
    console.error('Video compression failed:', error);
    throw new Error('Video compression failed: ' + error.message);
  }
};

// Add this helper function to upload files to Supabase
const uploadFileToSupabase = async (file, folder, userId) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('media')
    .getPublicUrl(filePath);

  return publicUrl;
};

// Add helper function to insert message
const insertMessage = async (supabase, userId, content = '', mediaUrl = null, mediaType = null) => {
  if (!userId) throw new Error('User ID is required');

  const messageData = {
    user_id: userId,
    content: content,
    ...(mediaUrl && { media_url: mediaUrl }),
    ...(mediaType && { media_type: mediaType })
  };

  const { data, error } = await supabase
    .from('messages')
    .insert([messageData])
    .select('*, users(username, is_admin)')
    .single();

  if (error) throw error;
  return data;
};

const OnlineUsersDrawer = ({ users, isOpen, onClose }) => {
  console.log('Online Users in Drawer:', users);
  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.onlineUsersDrawer} ${isOpen ? styles.show : ''}`}>
        <div className={styles.drawerHeader}>
          <h3>Online Users ({users.length})</h3>
          <button onClick={onClose}>×</button>
        </div>
        <ul className={styles.onlineUsersList}>
          {users.map((user) => (
            <li key={user.user_id}>
              {user.is_admin && <span className={styles.adminIcon}>👑 </span>}
              {user.username}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

// Function to filter out duplicate usernames
const getUniqueUsers = (users) => {
  const uniqueUsersMap = new Map();
  users.forEach(user => {
    if (!uniqueUsersMap.has(user.username)) {
      uniqueUsersMap.set(user.username, user);
    }
  });
  return Array.from(uniqueUsersMap.values());
};

// Add this function to create thumbnails for files
const createThumbnail = (file) => {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Set to 1 second to avoid black frame
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL());
      };
      video.src = URL.createObjectURL(file);
    }
  });
};

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

  // Add this state for loading
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFFmpegLoading, setIsFFmpegLoading] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);

  // Add new state for the upload dialog
  const [uploadDialog, setUploadDialog] = useState({ show: false, file: null });

  // Add new state for selected file
  const [selectedFile, setSelectedFile] = useState(null);

  // Add state for thumbnail
  const [thumbnail, setThumbnail] = useState(null);

  // Function to check if user is near bottom - make it more sensitive
  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return false;
    
    // Increase sensitivity by reducing the threshold from 100 to 150
    const scrollPosition = container.scrollHeight - container.scrollTop - container.clientHeight;
    return scrollPosition < 150;
  };

  // Handle new messages and scrolling behavior
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // If user sends a message (last message is from current user)
    const lastMessage = messages[messages.length - 1];
    const isOwnMessage = lastMessage?.users?.username === currentUser?.username;
    
    if (isOwnMessage || isNearBottom()) {
      // Delay the scroll slightly to ensure the new message is rendered
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } else {
      // If user is scrolled up, show notification
      setHasNewMessages(true);
    }
  }, [messages, currentUser?.username]);

  // Update the handleScroll function
  const handleScroll = (e) => {
    const container = e.target;
    
    // Hide new messages notification if user scrolls near bottom
    if (isNearBottom()) {
      setHasNewMessages(false);
    }

    // Check if scrolled near top for loading older messages
    if (container.scrollTop < 50 && !isLoading && hasMore) {
      loadOlderMessages();
    }
  };

  // Make scrollToBottom more reliable
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      setHasNewMessages(false);
    }
  };

  // Update handleFileUpload to create thumbnail
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    // Create thumbnail
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const thumbnailUrl = await createThumbnail(file);
      setThumbnail(thumbnailUrl);
    }
    // Reset the file input
    event.target.value = '';
  };

  // Clear thumbnail when removing file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setThumbnail(null);
  };

  // Modify handleSendMessage to handle both text and file
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    // Check if we have either a message or a file
    if ((!newMessage.trim() && !selectedFile) || !currentUser?.id) return;
    if (newMessage.length > MAX_MESSAGE_LENGTH) return;

    try {
      let mediaUrl = null;
      let mediaType = null;

      // If we have a file, upload it first
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);

        let fileToUpload = selectedFile;
        if (selectedFile.type.startsWith('image/')) {
          setUploadProgress(10);
          fileToUpload = await compressImage(selectedFile);
          setUploadProgress(30);
        }

        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const filePath = `${selectedFile.type.startsWith('video/') ? 'videos' : 'images'}/${fileName}`;

        // Upload with progress tracking
        const uploadPromise = new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              setUploadProgress(Math.round(percentComplete));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
              resolve(xhr.response);
            } else {
              reject(new Error('Upload failed'));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
          });

          supabase.storage
            .from('media')
            .createSignedUploadUrl(filePath)
            .then(({ data: { signedUrl }, error }) => {
              if (error) {
                reject(error);
                return;
              }

              xhr.open('PUT', signedUrl);
              xhr.setRequestHeader('Content-Type', selectedFile.type);
              xhr.send(fileToUpload);
            });
        });

        await uploadPromise;
        setUploadProgress(100);

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        mediaUrl = publicUrl;
        mediaType = selectedFile.type;
      }

      // Send message with media if present
      await insertMessage(
        supabase,
        currentUser.id,
        newMessage.trim(),
        mediaUrl,
        mediaType
      );

      // Clear inputs
      setNewMessage('');
      setSelectedFile(null);
      setUploadProgress(0);
      
      // Scroll to bottom
      setTimeout(scrollToBottom, 100);

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsUploading(false);
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
            const state = presenceSubscription.presenceState();
            const presentUsers = Object.values(state).flat().map(presence => ({
              user_id: presence.user_id,
              username: presence.username,
              is_admin: presence.is_admin
            }));

            // Use the function to get unique users
            const uniqueUsers = getUniqueUsers(presentUsers);
            console.log('Present Users:', uniqueUsers); // Debugging log
            setOnlineUsers(uniqueUsers);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceSubscription.track({
                user_id: currentUser.id,
                username: currentUser.username,
                is_admin: currentUser.is_admin
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

  useEffect(() => {
    let presenceSubscription;

    const setupPresence = async () => {
      if (!currentUser?.id) return;

      try {
        // Clean up any existing subscriptions
        const existingChannels = supabase.getChannels();
        for (const channel of existingChannels) {
          await channel.unsubscribe();
        }

        // Set up presence channel
        presenceSubscription = supabase
          .channel('online-users')
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            setOnlineUsers(prevUsers => [...prevUsers, ...newPresences]);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            setOnlineUsers(prevUsers => 
              prevUsers.filter(user => 
                !leftPresences.find(left => left.user_id === user.user_id)
              )
            );
          })
          .on('presence', { event: 'sync' }, () => {
            const state = presenceSubscription.presenceState();
            // Convert presence state to array of users
            const users = Object.values(state).flat();
            setOnlineUsers(users);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceSubscription.track({
                user_id: currentUser.id,
                username: currentUser.username,
                is_admin: currentUser.is_admin
              });
            }
          });

      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    setupPresence();

    // Cleanup function
    return () => {
      if (presenceSubscription) {
        presenceSubscription.untrack();
        presenceSubscription.unsubscribe();
      }
    };
  }, [currentUser?.id, currentUser?.username, currentUser?.is_admin]);

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

  const handleImageClick = (url) => {
    setSelectedImage(url);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  // Update message rendering to handle media
  const renderMessage = (message) => {
    const isImage = message.media_type?.startsWith('image/');
    const isVideo = message.media_type?.startsWith('video/');
    const isOwnMessage = message.users?.username === currentUser?.username;
    const isAdmin = message.users?.is_admin; // Check if the user is an admin

    return (
      <div className={styles.messageContainer}>
        {!isOwnMessage && (
          <div className={styles.messageUsername}>
            {isAdmin && <span className={styles.adminIcon}>👑</span>}
            {message.users?.username}
          </div>
        )}
        <div className={`${styles.messageContent} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
          {message.media_url ? (
            <div className={styles.mediaContainer}>
              {isImage && (
                <img
                  src={message.media_url}
                  alt="Shared"
                  className={styles.sharedImage}
                  onClick={() => handleImageClick(message.media_url)}
                />
              )}
              {isVideo && (
                <div className={styles.mediaContainer}>
                  <video
                    controls
                    className={styles.sharedVideo}
                    preload="metadata"
                    crossOrigin="anonymous"
                    playsInline
                  >
                    <source 
                      src={message.media_url} 
                      type={message.media_type}
                      crossOrigin="anonymous"
                    />
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.messageText}>
              {formatMessageContent(message.content)}
            </div>
          )}
          <span className={styles.messageTime}>
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    );
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

            <OnlineUsersDrawer 
              users={onlineUsers}
              isOpen={showOnlineUsers}
              onClose={() => setShowOnlineUsers(false)}
            />

            <div 
              ref={messagesContainerRef}
              className={styles.messages} 
              onScroll={handleScroll}
              tabIndex={0}
            >
              {isLoading && (
                <div className={styles.loadingMore}>
                  Loading more messages...
                </div>
              )}
              
              {messages.map((message) => {
                const isOwnMessage = message.users?.username === currentUser?.username;
                
                return (
                  <div key={message.id} className={styles.messageContainer}>
                    {!isOwnMessage && (
                      <div className={styles.messageUsername}>
                        {message.users?.is_admin && <span className={styles.adminIcon}>👑</span>}
                        {message.users?.username}
                      </div>
                    )}
                    <div className={`${styles.messageContent} ${isOwnMessage ? styles.ownMessage : styles.otherMessage}`}>
                      {/* Show text content if it exists */}
                      {message.content && (
                        <div className={styles.messageText}>
                          {formatMessageContent(message.content)}
                        </div>
                      )}
                      
                      {/* Show media if it exists */}
                      {message.media_url && (
                        <div className={styles.mediaContainer}>
                          {message.media_type?.startsWith('image/') && (
                            <img
                              src={message.media_url}
                              alt="Shared"
                              className={styles.sharedImage}
                              onClick={() => handleImageClick(message.media_url)}
                            />
                          )}
                          {message.media_type?.startsWith('video/') && (
                            <div className={styles.mediaContainer}>
                              <video
                                controls
                                className={styles.sharedVideo}
                                preload="metadata"
                                crossOrigin="anonymous"
                                playsInline
                              >
                                <source 
                                  src={message.media_url} 
                                  type={message.media_type}
                                  crossOrigin="anonymous"
                                />
                                Your browser does not support the video tag.
                              </video>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <span className={styles.messageTime}>
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                  placeholder={selectedFile ? "Add a message to your media (optional)" : "Type your message..."}
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <span className={styles.charCount}>
                  {newMessage.length}/{MAX_MESSAGE_LENGTH}
                </span>
                {selectedFile && (
                  <div className={styles.selectedFile}>
                    {thumbnail && (
                      <div className={styles.thumbnailContainer}>
                        <img src={thumbnail} alt="Preview" className={styles.thumbnail} />
                      </div>
                    )}
                    <div className={styles.fileInfo}>
                      <span className={styles.fileName}>{selectedFile.name}</span>
                      <span className={styles.fileSize}>
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRemoveFile}
                      className={styles.removeFile}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <label className={`${styles.uploadButton} ${isUploading ? styles.uploading : ''} ${selectedFile ? styles.hasFile : ''}`}>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  accept="image/*,video/*"
                  style={{ display: 'none' }}
                />
                {isUploading ? (
                  <div className={styles.spinner} />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={styles.uploadIcon}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                  </svg>
                )}
              </label>
              <button 
                type="submit"
                className={styles.sendButton}
                disabled={(!newMessage.trim() && !selectedFile) || isUploading}
              >
                Send
              </button>
            </form>

            {isUploading && <UploadProgressBar progress={uploadProgress} />}
          </div>
        </main>
      </div>
      {selectedImage && (
        <ImageModal imageUrl={selectedImage} onClose={closeImageModal} />
      )}
      {uploadDialog.show && (
        <MediaUploadDialog
          file={uploadDialog.file}
          onConfirm={handleUploadConfirm}
          onCancel={() => setUploadDialog({ show: false, file: null })}
        />
      )}
    </>
  );
}
