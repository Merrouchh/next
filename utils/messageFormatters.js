export const formatMessageContent = (content) => {
  if (!content) return '';

  // Convert URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return content.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#FFD700', textDecoration: 'underline' }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export const formatMessageTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};
