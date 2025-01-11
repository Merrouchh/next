import styles from '../../styles/Chat.module.css';
import { formatMessageContent, formatMessageTime } from '../../utils/messageFormatters';

const ChatMessage = ({ message, isOwnMessage, onImageClick, onMediaLoad }) => {
  const isImage = message.media_type?.startsWith('image/');
  const isVideo = message.media_type?.startsWith('video/');

  return (
    <div className={`${styles.messageContainer} ${isOwnMessage ? styles.ownMessage : ''}`}>
      {!isOwnMessage && (
        <div className={styles.messageUsername}>
          {message.users?.is_admin && <span className={styles.adminIcon}>👑</span>}
          {message.users?.username}
        </div>
      )}
      <div className={`${styles.messageContent} ${isOwnMessage ? styles.ownMessageContent : styles.otherMessageContent}`}>
        {message.content && (
          <div className={styles.messageText}>
            {message.content}
          </div>
        )}
        {message.media_url && (
          <div className={styles.mediaContainer}>
            {isImage && (
              <img
                src={message.media_url}
                alt="Shared"
                className={styles.sharedImage}
                onClick={() => onImageClick(message.media_url)}
                onLoad={onMediaLoad}
                loading="lazy"
              />
            )}
            {isVideo && (
              <video
                controls
                className={styles.sharedVideo}
                preload="metadata"
                playsInline
                webkit-playsinline="true"
                onLoadedMetadata={onMediaLoad}
                controlsList="nodownload"
              >
                <source src={message.media_url} type="video/mp4" />
                <source src={message.media_url} type={message.media_type} />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        )}
        <span className={styles.messageTime}>
          {formatMessageTime(message.created_at)}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;
