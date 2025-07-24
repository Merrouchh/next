import React, { useMemo } from 'react';
import { FaInfo } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';

// Safe device detection utility
const isOldDevice = () => {
  try {
    if (typeof window === 'undefined') return false;
    if (!navigator || !navigator.userAgent) return false;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isOldIOS = /OS [5-9]_/.test(navigator.userAgent);
    
    return isIOS && isOldIOS;
  } catch (error) {
    console.log('Device detection error, assuming old device:', error);
    return true; // Assume old device on error for safety
  }
};

// Simple text renderer for old devices
const SimpleTextRenderer = ({ content }) => {
  const processedContent = useMemo(() => {
    if (!content) return 'Event details will be displayed here.';
    
    // Simple text processing for old devices
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/\n/g, '<br/>') // Line breaks
      .replace(/#{1,6}\s+(.*)/g, '<h3>$1</h3>') // Headers
      .replace(/- (.*)/g, '• $1'); // Simple bullet points
  }, [content]);

  return (
    <div 
      className={styles.eventDescription}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};

// Lazy loading for markdown components (only for modern devices)
const LazyMarkdownRenderer = React.lazy(() => {
  return import('./MarkdownRenderer').catch(() => {
    // Fallback if markdown renderer fails to load
    return { default: SimpleTextRenderer };
  });
});

const EventDescription = ({ event }) => {
  const shouldUseSimpleRenderer = useMemo(() => {
    return isOldDevice();
  }, []);

  return (
    <section className={styles.eventDescriptionSection}>
      <h2 className={styles.sectionHeading}>
        <FaInfo /> Event Details
      </h2>
      
      {shouldUseSimpleRenderer ? (
        <SimpleTextRenderer content={event.description} />
      ) : (
        <React.Suspense fallback={
          <div className={styles.eventDescription}>
            <p>Loading event details...</p>
          </div>
        }>
          <LazyMarkdownRenderer event={event} />
        </React.Suspense>
      )}
    </section>
  );
};

export default EventDescription; 