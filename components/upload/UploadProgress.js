import React, { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { UPLOAD_PHASES, UPLOAD_STATUS } from '@/utils/upload/progressUtils';
import styles from '@/styles/Upload.module.css';

export default function UploadProgress({ uploadId, onComplete }) {
  const { socket, joinUploadRoom, leaveUploadRoom } = useWebSocket();
  const [progress, setProgress] = useState({
    [UPLOAD_PHASES.UPLOAD]: 0,
    [UPLOAD_PHASES.OPTIMIZATION]: 0,
    [UPLOAD_PHASES.SAVING]: 0
  });
  const [currentPhase, setCurrentPhase] = useState(UPLOAD_PHASES.UPLOAD);
  const [status, setStatus] = useState(UPLOAD_STATUS.INITIALIZING);
  const [error, setError] = useState(null);
  const lastProgressRef = useRef(progress);

  useEffect(() => {
    if (!uploadId) return;

    console.log('[UploadProgress] Joining upload room:', uploadId);
    joinUploadRoom(uploadId);

    return () => {
      console.log('[UploadProgress] Leaving upload room:', uploadId);
      leaveUploadRoom(uploadId);
    };
  }, [uploadId, joinUploadRoom, leaveUploadRoom]);

  useEffect(() => {
    if (!socket || !uploadId) return;

    function handleProgress(data) {
      console.log('[UploadProgress] Raw progress update:', data);
      
      if (!data || !data.progress) return;

      setProgress(prevProgress => {
        const newProgress = { ...prevProgress };
        const lastProgress = lastProgressRef.current;

        // Handle uploading phase
        if (data.progress.uploading !== undefined) {
          console.log('[UploadProgress] Uploading progress:', data.progress.uploading);
          newProgress[UPLOAD_PHASES.UPLOAD] = Math.max(
            lastProgress[UPLOAD_PHASES.UPLOAD] || 0,
            data.progress.uploading
          );
        }

        // Handle optimization phase
        if (data.progress.optimizing !== undefined) {
          let optimizationProgress = 0;
          if (typeof data.progress.optimizing === 'object' && data.progress.optimizing.phase === 'OPTIMIZATION') {
            optimizationProgress = data.progress.optimizing.progress;
          } else {
            optimizationProgress = data.progress.optimizing;
          }
          console.log('[UploadProgress] Optimization progress:', optimizationProgress);
          newProgress[UPLOAD_PHASES.OPTIMIZATION] = Math.max(
            lastProgress[UPLOAD_PHASES.OPTIMIZATION] || 0,
            optimizationProgress
          );
        }

        // Handle saving phase
        if (data.progress.saving !== undefined) {
          console.log('[UploadProgress] Saving progress:', data.progress.saving);
          newProgress[UPLOAD_PHASES.SAVING] = Math.max(
            lastProgress[UPLOAD_PHASES.SAVING] || 0,
            data.progress.saving
          );
        }

        // Update phase based on progress
        if (newProgress[UPLOAD_PHASES.SAVING] > 0) {
          setCurrentPhase(UPLOAD_PHASES.SAVING);
        } else if (newProgress[UPLOAD_PHASES.OPTIMIZATION] > 0) {
          setCurrentPhase(UPLOAD_PHASES.OPTIMIZATION);
        } else {
          setCurrentPhase(UPLOAD_PHASES.UPLOAD);
        }

        // Store last progress values
        lastProgressRef.current = newProgress;

        console.log('[UploadProgress] Updated progress:', {
          progress: newProgress,
          phase: currentPhase,
          raw: data.progress
        });

        return newProgress;
      });

      // Update status if provided
      if (data.status) {
        setStatus(data.status);
        console.log('[UploadProgress] Status updated:', data.status);
      }

      // Check if upload is complete
      if (data.status === UPLOAD_STATUS.COMPLETED) {
        console.log('[UploadProgress] Upload complete');
        setProgress(prev => ({
          ...prev,
          [UPLOAD_PHASES.UPLOAD]: 100,
          [UPLOAD_PHASES.OPTIMIZATION]: 100,
          [UPLOAD_PHASES.SAVING]: 100
        }));
        if (onComplete) {
          setTimeout(onComplete, 1000);
        }
      }
    }

    function handleError(error) {
      console.error('[UploadProgress] Upload error:', error);
      setError(error.message || 'Upload failed');
      setStatus(UPLOAD_STATUS.ERROR);
    }

    console.log('[UploadProgress] Setting up socket listeners');
    socket.on('upload_progress', handleProgress);
    socket.on('upload_error', handleError);

    return () => {
      console.log('[UploadProgress] Cleaning up socket listeners');
      socket.off('upload_progress', handleProgress);
      socket.off('upload_error', handleError);
    };
  }, [socket, uploadId, onComplete, currentPhase]);

  // Calculate overall progress
  const overallProgress = (() => {
    const weights = {
      [UPLOAD_PHASES.UPLOAD]: 0.33,
      [UPLOAD_PHASES.OPTIMIZATION]: 0.33,
      [UPLOAD_PHASES.SAVING]: 0.34
    };

    let total = 0;
    Object.entries(progress).forEach(([phase, value]) => {
      total += (value * weights[phase]);
    });

    const finalProgress = Math.min(100, Math.round(total));
    console.log('[UploadProgress] Overall progress:', {
      progress,
      weights,
      total,
      final: finalProgress
    });

    return finalProgress;
  })();

  return (
    <div className={styles.uploadProgress}>
      <h3>Upload Progress</h3>
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : (
        <>
          <div className={styles.phases}>
            {Object.values(UPLOAD_PHASES).map((phase) => (
              <div key={phase} className={`${styles.phase} ${currentPhase === phase ? styles.active : ''}`}>
                <div className={styles.label}>{phase}</div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progress} 
                    style={{ 
                      width: `${progress[phase]}%`,
                      backgroundColor: currentPhase === phase ? '#4CAF50' : '#8BC34A'
                    }} 
                  />
                </div>
                <div className={styles.percentage}>{progress[phase]}%</div>
              </div>
            ))}
          </div>
          <div className={styles.overall}>
            <div className={styles.label}>Overall Progress</div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progress} 
                style={{ 
                  width: `${overallProgress}%`,
                  backgroundColor: '#2196F3'
                }} 
              />
            </div>
            <div className={styles.percentage}>{overallProgress}%</div>
          </div>
          {status === UPLOAD_STATUS.COMPLETED && (
            <div className={styles.success}>Upload completed successfully!</div>
          )}
        </>
      )}
    </div>
  );
} 