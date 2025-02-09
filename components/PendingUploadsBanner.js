import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/PendingUploadsBanner.module.css';
import { MdAccessTime, MdSync, MdCheckCircle } from 'react-icons/md';

const PendingUploadsBanner = ({ pendingUploads }) => {
  const [completedUploads, setCompletedUploads] = useState(new Set());
  const previousUploadsRef = useRef({});

  useEffect(() => {
    const timeouts = new Set();
    
    pendingUploads.forEach(upload => {
      const previousStatus = previousUploadsRef.current[upload.id]?.status;
      
      if (previousStatus && 
          previousStatus !== 'completed' && 
          upload.status === 'completed') {
        setCompletedUploads(prev => new Set(prev).add(upload.id));
        
        const timeout = setTimeout(() => {
          setCompletedUploads(prev => {
            const newSet = new Set(prev);
            newSet.delete(upload.id);
            return newSet;
          });
        }, 5000);
        
        timeouts.add(timeout);
      }
      previousUploadsRef.current[upload.id] = upload;
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [pendingUploads]);

  // Filter out uploads that we don't want to show
  const uploadsToShow = pendingUploads.filter(upload => {
    // If it's completed, only show if it's in the animation window
    if (upload.status === 'completed') {
      return completedUploads.has(upload.id);
    }
    // Show all non-completed uploads
    return true;
  });

  if (!uploadsToShow || uploadsToShow.length === 0) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return <MdSync className={`${styles.icon} ${styles.rotating}`} />;
      case 'completed':
        return <MdCheckCircle className={`${styles.icon} ${styles.success}`} />;
      default:
        return <MdAccessTime className={styles.icon} />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  return (
    <div className={styles.bannerContainer}>
      {uploadsToShow.map((upload) => {
        const isCompletedAndTracked = upload.status === 'completed' && completedUploads.has(upload.id);
        
        return (
          <div 
            key={upload.id} 
            className={`${styles.banner} ${styles[upload.status]} ${isCompletedAndTracked ? styles.fadeOut : ''}`}
          >
            <div className={styles.iconWrapper}>
              {getStatusIcon(upload.status)}
            </div>
            <div className={styles.content}>
              <h3>{upload.title}</h3>
              <p>
                <span className={styles.game}>{upload.game}</span>
                <span className={`${styles.status} ${styles[upload.status]}`}>
                  {getStatusText(upload.status)}
                </span>
                {upload.status === 'uploaded' && upload.queue_number > 0 && (
                  <span className={styles.queueNumber}>
                    Queue: #{upload.queue_number}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingUploadsBanner; 