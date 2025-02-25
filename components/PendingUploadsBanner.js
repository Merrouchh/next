import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/PendingUploadsBanner.module.css';
import { MdAccessTime, MdSync, MdCheckCircle, MdInfo } from 'react-icons/md';

const getStatusDetails = (upload) => {
  const { status, processing_progress, ready_to_stream, error_message } = upload;
  const progress = processing_progress || 0;

  switch (status) {
    case 'pendingupload':
      return {
        text: 'Starting upload...',
        progress: 0,
        color: '#FFA000',
        showPulse: true
      };
    case 'uploading':
      return {
        text: 'Uploading to server...',
        progress: progress,
        color: '#2196F3',
        showPulse: true
      };
    case 'queued':
      return {
        text: 'Queued for processing...',
        progress: 5,
        color: '#FF9800',
        showPulse: true
      };
    case 'inprogress':
    case 'processing':
      return {
        text: `Processing ${Math.round(progress)}%`,
        progress: progress || 10,
        color: '#2196F3',
        showPulse: true
      };
    case 'ready':
      return {
        text: ready_to_stream ? '✓ Ready to Stream' : 'Finalizing Stream...',
        progress: ready_to_stream ? 100 : 95,
        color: '#4CAF50',
        icon: <MdCheckCircle />
      };
    case 'error':
      return {
        text: error_message || 'Error processing video',
        progress: 0,
        color: '#f44336',
        icon: <MdInfo />,
        tooltip: error_message
      };
    case 'timed_out':
      return {
        text: 'Upload timed out',
        progress: 0,
        color: '#f44336',
        icon: <MdInfo />
      };
    default:
      return {
        text: status,
        progress: 0,
        color: '#757575',
        showPulse: true
      };
  }
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatDuration = (seconds) => {
  if (!seconds) return '';
  return new Date(seconds * 1000).toISOString().substr(11, 8);
};

// Memoize individual upload item
const UploadItem = memo(({ upload, statusDetails, isCompleted, onAnimationEnd }) => {
  return (
    <div 
      className={`${styles.uploadItem} ${isCompleted ? styles.fadeOut : ''}`}
      data-status={upload.status}
      data-progress={statusDetails.progress}
      onAnimationEnd={isCompleted ? onAnimationEnd : undefined}
    >
      <div className={styles.uploadInfo}>
        <span className={styles.title}>{upload.title}</span>
        <div className={styles.metadata}>
          {upload.game && (
            <span className={styles.game}>{upload.game}</span>
          )}
          {upload.file_size && (
            <span className={styles.fileSize}>
              {formatFileSize(upload.file_size)}
            </span>
          )}
          {upload.duration && (
            <span className={styles.duration}>
              {formatDuration(upload.duration)}
            </span>
          )}
          {upload.resolution && (
            <span className={styles.resolution}>
              {upload.resolution}
            </span>
          )}
        </div>
      </div>
      <div className={styles.statusContainer}>
        <div className={styles.progressBar}>
          <div 
            className={`${styles.progressFill} ${statusDetails.showPulse ? styles.pulse : ''}`}
            style={{ 
              width: `${statusDetails.progress}%`,
              background: statusDetails.color
            }}
          />
        </div>
        <span className={styles.status} style={{ color: statusDetails.color }}>
          {statusDetails.text}
        </span>
      </div>
    </div>
  );
});

const PendingUploadsBanner = memo(({ userId }) => {
  const [pendingUploads, setPendingUploads] = useState([]);
  const [completedUploads, setCompletedUploads] = useState(new Set());
  const previousUploadsRef = useRef({});
  const isFirstLoadRef = useRef(true);
  const { supabase } = useAuth();

  // Memoize fetch function
  const fetchPendingUploads = useCallback(async () => {
    const { data, error } = await supabase
      .from('media_clips')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['video_in_queue', 'processing'])
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending uploads:', error);
      return;
    }

    if (data) {
      setPendingUploads(data);
      isFirstLoadRef.current = false;
    }
  }, [supabase, userId]);

  // Memoize update handler
  const handleUpdate = useCallback((payload) => {
    switch (payload.eventType) {
      case 'INSERT':
        if (['video_in_queue', 'processing'].includes(payload.new.status)) {
          setPendingUploads(prev => [payload.new, ...prev]);
        }
        break;

      case 'UPDATE':
        setPendingUploads(prev => {
          if (isFirstLoadRef.current) return prev;

          const isTracking = prev.some(upload => upload.id === payload.new.id);
          
          if (!isTracking && ['video_in_queue', 'processing'].includes(payload.new.status)) {
            return [payload.new, ...prev];
          }

          return prev.map(upload => {
            if (upload.id === payload.new.id) {
              if (['video_in_queue', 'processing'].includes(payload.new.status)) {
                return payload.new;
              }
              if (payload.new.status === 'ready' && payload.new.ready_to_stream) {
                setCompletedUploads(prev => new Set(prev).add(upload.id));
                return payload.new;
              }
              return null;
            }
            return upload;
          }).filter(Boolean);
        });
        break;

      case 'DELETE':
        setPendingUploads(prev => 
          prev.filter(upload => upload.id !== payload.old.id)
        );
        break;
    }
  }, [isFirstLoadRef]);

  // Add handler for animation end
  const handleAnimationEnd = useCallback((uploadId) => {
    setCompletedUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(uploadId);
      return newSet;
    });
    setPendingUploads(prev => 
      prev.filter(upload => upload.id !== uploadId)
    );
  }, []);

  useEffect(() => {
    let subscription;
    fetchPendingUploads();

    subscription = supabase
      .channel('media_clips_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'media_clips',
        filter: `user_id=eq.${userId}`
      }, handleUpdate)
      .subscribe();

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [supabase, userId, fetchPendingUploads, handleUpdate]);

  // Memoize uploads filter
  const uploadsToShow = React.useMemo(() => 
    pendingUploads.filter(upload => {
      if (['video_in_queue', 'processing'].includes(upload.status)) {
        return true;
      }
      if (upload.status === 'ready' && upload.ready_to_stream) {
        return completedUploads.has(upload.id);
      }
      return false;
    }), [pendingUploads, completedUploads]);

  if (!uploadsToShow?.length) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <h3>Processing Videos ({uploadsToShow.length})</h3>
      </div>
      <div className={styles.uploadsList}>
        {uploadsToShow.map((upload) => (
          <UploadItem 
            key={upload.id} 
            upload={upload}
            statusDetails={getStatusDetails(upload)}
            isCompleted={completedUploads.has(upload.id)}
            onAnimationEnd={() => handleAnimationEnd(upload.id)}
          />
        ))}
      </div>
    </div>
  );
});

export default PendingUploadsBanner; 