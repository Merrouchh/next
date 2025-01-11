import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSupabaseClient } from '../utils/supabase/client';
import styles from '../styles/Chat.module.css';
import Head from 'next/head';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import ImageModal from '../components/ImageModal';
import UploadProgressBar from '../components/UploadProgressBar';
import MediaUploadDialog from '../components/MediaUploadDialog';
import ChatInput from '../components/chat/ChatInput';
import ChatHeader from '../components/chat/ChatHeader';
import ChatMessage from '../components/chat/ChatMessage';
import imageCompression from 'browser-image-compression';

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
        workerPath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js',
        mainName: 'main',
        logger: ({ message }) => console.log('FFmpeg Log:', message),
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
    alert('Video compression is not available. Uploading original video...');
    return null;
  }
};

const compressImage = async (file) => {
  try {
    console.log('Starting image compression...');
    console.log('Original image size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    const options = {
      maxSizeMB: 1,           // Maximum size in MB
      maxWidthOrHeight: 1920, // Maximum width/height
      useWebWorker: true,     // Use web worker for better performance
      fileType: file.type,
      initialQuality: 0.8,    // Initial compression quality
    };

    // Check if file is too small to compress
    if (file.size / 1024 / 1024 < 0.5) {
      console.log('File is already small enough, skipping compression');
      return file;
    }

    const compressedFile = await imageCompression(file, options);
    console.log('Compressed image size:', (compressedFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    return compressedFile;
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return file;
  }
};

const getFileBlob = async (file) => {
  const response = await fetch(URL.createObjectURL(file));
  const data = await response.blob();
  return data;
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

// Update createThumbnail function to be more mobile-friendly
const createThumbnail = (file) => {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      
      video.onloadeddata = () => {
        video.currentTime = 1; // Set to 1 second to avoid black frame
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(thumbnailUrl);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      video.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };

      video.src = url;
      video.load();
    }
  });
};

export default function Chat() {
  const { isLoggedIn, user: currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const messagesContainerRef = useRef(null);
  const MESSAGES_PER_LOAD = 30;
  
  const messagesEndRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevMessagesRef = useRef(null);
  const [allowAutoScroll, setAllowAutoScroll] = useState(true);

  // Optimized check if user is near bottom
  const checkIfNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 150;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, []);

  // Optimized scroll handler
  const handleScroll = useCallback(() => {
    const isNearBottom = checkIfNearBottom();
    setIsAtBottom(isNearBottom);
    if (isNearBottom) {
      setHasNewMessages(false);
    }
  }, [checkIfNearBottom]);

  // Optimized scroll to bottom
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);

  // Update the polling effect to handle notifications correctly
  useEffect(() => {
    if (!isLoggedIn) return;

    const pollInterval = setInterval(async () => {
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(username, is_admin)')
        .gt('created_at', lastMessage.created_at)
        .order('created_at', { ascending: true });

      if (error || !data?.length) return;

      // Add new messages without affecting scroll
      setMessages(prev => {
        const uniqueMessages = data.filter(newMsg => 
          !prev.some(existingMsg => existingMsg.id === newMsg.id)
        );
        return [...prev, ...uniqueMessages];
      });
      
      const isOwnMessage = data[data.length - 1].user_id === currentUser?.id;
      const container = messagesContainerRef.current;
      const isCurrentlyAtBottom = container && 
        (container.scrollHeight - container.scrollTop - container.clientHeight) < 100;
      
      // Only scroll for own messages when already at bottom
      if (isOwnMessage && isCurrentlyAtBottom) {
        container.scrollTop = container.scrollHeight;
      } 
      // Show notification for other users' messages when not at bottom
      else if (!isCurrentlyAtBottom && !isOwnMessage) {
        setHasNewMessages(true);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isLoggedIn, messages, currentUser?.id]);

  // Handle initial load scroll
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Handle notification click
  const scrollToNewMessages = useCallback(() => {
    setHasNewMessages(false);
    setIsUserScrolling(false); // Reset user scrolling state
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  // LoadMore component can stay outside the main component
  const LoadMore = ({ loading, hasMore, onClick }) => {
    if (!hasMore) return null;
    
    return (
      <div className={styles.loadMoreContainer}>
        <button 
          className={styles.loadMoreButton}
          onClick={onClick}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Load Previous Messages'}
        </button>
      </div>
    );
  };

  // Add this useEffect to fetch messages initially
  useEffect(() => {
    if (isLoggedIn) {
      loadInitialMessages();
    }
  }, [isLoggedIn]);

  const loadInitialMessages = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(username, is_admin)')
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_LOAD);

      if (error) throw error;

      const sortedMessages = data.reverse();
      setMessages(sortedMessages);
      
      // Simple, direct scroll after messages are set
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
        setIsInitialLoad(false);
      }, 100);

      setHasMore(data.length === MESSAGES_PER_LOAD);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the polling effect to handle messages properly
  useEffect(() => {
    if (!isLoggedIn) return;

    const pollInterval = setInterval(async () => {
      if (messages.length === 0) return;

      const lastMessage = messages[messages.length - 1];
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(username, is_admin)')
        .gt('created_at', lastMessage.created_at)
        .order('created_at', { ascending: true });

      if (error || !data?.length) return;

      // Add new messages while ensuring unique IDs
      setMessages(prev => {
        const uniqueMessages = data.filter(newMsg => 
          !prev.some(existingMsg => existingMsg.id === newMsg.id)
        );
        return [...prev, ...uniqueMessages];
      });
      
      const isOwnMessage = data[data.length - 1].user_id === currentUser?.id;
      
      if (isOwnMessage || checkIfNearBottom()) {
        scrollToBottom();
      } else {
        setHasNewMessages(true);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isLoggedIn, messages, currentUser?.id, checkIfNearBottom, scrollToBottom]);

  // Update handleSendMessage
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || isUploading) return;

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);

        let fileToUpload = selectedFile;
        
        if (selectedFile.type.startsWith('image/')) {
          setUploadProgress(10);
          fileToUpload = await compressImage(selectedFile);
          mediaType = selectedFile.type;
          setUploadProgress(30);
        } else if (selectedFile.type.startsWith('video/')) {
          mediaType = selectedFile.type;
          setUploadProgress(5);
        }

        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const filePath = `${selectedFile.type.startsWith('video/') ? 'videos' : 'images'}/${fileName}`;

        const { data: uploadData, error: uploadError } = await new Promise((resolve, reject) => {
          const upload = supabase.storage
            .from('media')
            .upload(filePath, fileToUpload, {
              onUploadProgress: (progress) => {
                if (selectedFile.type.startsWith('video/')) {
                  const uploadProgress = 5 + (progress.percent * 0.93);
                  setUploadProgress(Math.round(uploadProgress));
                } else {
                  const uploadProgress = 30 + (progress.percent * 0.68);
                  setUploadProgress(Math.round(uploadProgress));
                }
              },
            });

          upload.then(result => {
            if (result.error) {
              reject(result.error);
            } else {
              setUploadProgress(98);
              resolve(result);
            }
          }).catch(reject);
        });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        mediaUrl = publicUrl;
        setUploadProgress(100);

        if (mediaUrl) {
          const messageData = await insertMessage(
            supabase,
            currentUser.id,
            newMessage.trim(),
            mediaUrl,
            mediaType
          );

          if (messageData) {
            setMessages(prev => [...prev, messageData]);
            setTimeout(() => {
              const container = messagesContainerRef.current;
              if (container) {
                container.scrollTop = container.scrollHeight;
                setIsAtBottom(true);
              }
            }, 100);
          }
        }
      } else if (newMessage.trim()) {
        const messageData = await insertMessage(
          supabase,
          currentUser.id,
          newMessage.trim()
        );

        if (messageData) {
          setMessages(prev => [...prev, messageData]);
          setTimeout(() => {
            const container = messagesContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
              setIsAtBottom(true);
            }
          }, 100);
        }
      }

      setNewMessage('');
      setSelectedFile(null);
      setThumbnail(null);

    } catch (error) {
      alert('Failed to send message. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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
    const isLastMessage = message.id === messages[messages.length - 1]?.id;

    return (
      <div 
        className={`${styles.messageContainer} ${
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        }`}
      >
        {!isOwnMessage && (
          <div className={styles.messageUsername}>
            {message.users?.is_admin && <span className={styles.adminIcon}>👑</span>}
            {message.users?.username}
          </div>
        )}
        <div 
          className={`${styles.messageContent} ${
            isOwnMessage ? styles.ownMessage : styles.otherMessage
          }`}
        >
          {message.media_url && (
            <div className={styles.mediaContainer}>
              {isImage && (
                <img
                  src={message.media_url}
                  alt="Shared"
                  className={styles.sharedImage}
                  onClick={() => handleImageClick(message.media_url)}
                  onLoad={() => handleMediaLoad()}
                  loading="lazy"
                />
              )}
              {isVideo && (
                <video
                  controls
                  className={styles.sharedVideo}
                  preload="metadata"
                  playsInline
                  webkit-playsinline="true" // For iOS support
                  onLoadedMetadata={() => handleMediaLoad()}
                  controlsList="nodownload" // Prevent download button
                >
                  <source 
                    src={message.media_url} 
                    type="video/mp4" // Force mp4 type
                  />
                  <source 
                    src={message.media_url} 
                    type={message.media_type}
                  />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          )}
          {message.content && (
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

  // Update handleMediaLoad to not trigger scroll
  const handleMediaLoad = useCallback(() => {
    // Only scroll on initial load
    if (isInitialLoad && isAtBottom) {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
  }, [isInitialLoad, isAtBottom]);

  // Add this useEffect to handle scroll position restoration
  useEffect(() => {
    if (!isInitialLoad && messages.length > 0) {
      const savedScrollPosition = sessionStorage.getItem('chatScrollPosition');
      const messagesContainer = messagesContainerRef.current;
      
      if (savedScrollPosition && messagesContainer) {
        messagesContainer.scrollTop = parseInt(savedScrollPosition, 10);
      }
      // Remove automatic scroll to bottom here
    }
  }, [isInitialLoad, messages.length]);

  // Save scroll position when user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      const messagesContainer = messagesContainerRef.current;
      if (messagesContainer) {
        sessionStorage.setItem('chatScrollPosition', messagesContainer.scrollTop.toString());
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (isLoading || !hasMore) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*, users(username, is_admin)')
        .order('created_at', { ascending: false })
        .lt('created_at', messages[0].created_at)
        .limit(MESSAGES_PER_LOAD);

      if (error) throw error;

      if (data) {
        const sortedMessages = data.reverse();
        setMessages(prev => [...sortedMessages, ...prev]);
        setHasMore(data.length === MESSAGES_PER_LOAD);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, messages, supabase]);

  // Add missing handleFileUpload function
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setSelectedFile(file);
    
    try {
      // Create thumbnail
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const thumbnailUrl = await createThumbnail(file);
        setThumbnail(thumbnailUrl);
      }
    } catch (error) {
      console.error('Error creating thumbnail:', error);
    }
    
    // Reset the file input
    event.target.value = '';
  };

  // Add missing handleRemoveFile function
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setThumbnail(null);
    setUploadProgress(0);
  };

  if (!isLoggedIn) return null;

  return (
    <>
      <Head>
        <title>Chat Room</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
      </Head>

      <div className={styles.chatWrapper}>
        <ChatHeader />
        
        <div className={styles.messagesWrapper}>
          <div 
            ref={messagesContainerRef}
            className={styles.messages}
            onScroll={handleScroll}
          >
            <LoadMore 
              loading={isLoading}
              hasMore={hasMore}
              onClick={loadOlderMessages}
            />
            {messages.map((message) => {
              const isOwnMessage = message.users?.username === currentUser?.username;
              return (
                <div 
                  key={message.id} 
                  className={`${styles.messageContainer} ${
                    isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
                  }`}
                >
                  {!isOwnMessage && (
                    <div className={styles.messageUsername}>
                      {message.users?.is_admin && <span className={styles.adminIcon}>👑</span>}
                      {message.users?.username}
                    </div>
                  )}
                  <div 
                    className={`${styles.messageContent} ${
                      isOwnMessage ? styles.ownMessage : styles.otherMessage
                    }`}
                  >
                    {message.media_url && (
                      <div className={styles.mediaContainer}>
                        {message.media_type?.startsWith('image/') && (
                          <img
                            src={message.media_url}
                            alt="Shared"
                            className={styles.sharedImage}
                            onClick={() => handleImageClick(message.media_url)}
                            onLoad={() => handleMediaLoad()}
                            loading="lazy"
                          />
                        )}
                        {message.media_type?.startsWith('video/') && (
                          <video
                            controls
                            className={styles.sharedVideo}
                            preload="metadata"
                            playsInline
                            webkit-playsinline="true" // For iOS support
                            onLoadedMetadata={() => handleMediaLoad()}
                            controlsList="nodownload" // Prevent download button
                          >
                            <source 
                              src={message.media_url} 
                              type="video/mp4" // Force mp4 type
                            />
                            <source 
                              src={message.media_url} 
                              type={message.media_type}
                            />
                            Your browser does not support the video tag.
                          </video>
                        )}
                      </div>
                    )}
                    {message.content && (
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
            })}
            <div className={styles.bottomSpacer} ref={messagesEndRef} />
          </div>

          {hasNewMessages && !isAtBottom && (
            <button 
              className={styles.newMessagesNotif}
              onClick={() => setHasNewMessages(false)}
            >
              New messages ↓
            </button>
          )}
        </div>

        <ChatInput 
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          selectedFile={selectedFile}
          thumbnail={thumbnail}
          handleFileUpload={handleFileUpload}
          handleRemoveFile={handleRemoveFile}
          handleSendMessage={handleSendMessage}
          isUploading={isUploading}
          MAX_MESSAGE_LENGTH={MAX_MESSAGE_LENGTH}
        />
        
        {isUploading && <UploadProgressBar progress={uploadProgress} />}
      </div>

      {selectedImage && (
        <ImageModal imageUrl={selectedImage} onClose={closeImageModal} />
      )}
    </>
  );
}
