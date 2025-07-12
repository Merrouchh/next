import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Upload.module.css';
import { MdGamepad, MdPublic, MdLock, MdCloudUpload, MdWarning } from 'react-icons/md';
import Head from 'next/head';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { useDropzone } from 'react-dropzone';
import UploadProgress from '../components/UploadProgress';
import dynamic from 'next/dynamic';
import { useVideoUpload } from '../hooks/useVideoUpload';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import PendingUploadsBanner from '../components/PendingUploadsBanner';

// Constants for file validation
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const SUPPORTED_FORMATS = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-matroska': ['.mkv']
};

// Dynamically import the VideoThumbnail component with no SSR
const VideoThumbnail = dynamic(() => import('../components/VideoThumbnail'), {
  ssr: false,
  loading: () => <ThumbnailLoader />
});

// Extract loading component
const ThumbnailLoader = memo(() => (
  <div className={styles.previewLoading}>
    <div className={styles.spinner}></div>
    <p>Preparing preview...</p>
  </div>
));

const _updatedUploadStyles = {
  uploadMain: {
    backgroundColor: 'var(--dark-bg-primary)',
    color: 'var(--dark-text-primary)'
  },
  uploadCard: {
    backgroundColor: 'var(--dark-card-bg)',
    border: '1px solid var(--dark-border)'
  },
  input: {
    backgroundColor: 'var(--dark-input-bg)',
    color: 'var(--dark-text-primary)',
    border: '1px solid var(--dark-border)'
  },
  select: {
    backgroundColor: 'var(--dark-input-bg)',
    color: 'var(--dark-text-primary)',
    border: '1px solid var(--dark-border)'
  },
  dropzone: {
    backgroundColor: 'var(--dark-bg-elevated)',
    border: '2px dashed var(--dark-border)',
    '&:hover': {
      borderColor: 'var(--dark-accent-primary)'
    }
  }
};

export async function getServerSideProps({ _req, _res }) {
  // This makes the page dynamic and prevents static generation
  return {
    props: {
      // You can pass any initial props here if needed
    }
  };
}

const UploadPage = () => {
  const [title, setTitle] = useState('');
  const [game, setGame] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, isLoggedIn, supabase } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(null);
  const currentUploadUid = useRef(null);
  const sessionId = useRef(uuidv4()).current;
  const videoRef = useRef(null);
  const blobUrlRef = useRef(null);
  const processingTimeoutRef = useRef(null);
  const [fileProcessed, setFileProcessed] = useState(false);
  const [bannerKey, setBannerKey] = useState(0); // Add state to force banner refresh
  const [localUploadStatus, setLocalUploadStatus] = useState('idle');

  const { 
    uploadStatus, 
    uploadProgress, 
    uploadFile, 
    uploadWithUrl,
    cancelUpload,
    resetForm 
  } = useVideoUpload();

  // Define logEvent function before it's used
  const logEvent = useCallback((event, details) => {
    // ... logging logic ...
    console.log(`[${event}]`, details);
  }, [username, sessionId]);

  // Improved blob cleanup
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch (error) {
        console.warn('Failed to revoke blob URL:', error);
      }
      blobUrlRef.current = null;
    }
  }, []);

  // Debounced title change handler
  const handleTitleChange = useCallback((e) => {
    // Simply update the title state without affecting the blob URL or preview
    setTitle(e.target.value);
  }, []);

  // Clean up unmount effect - Improved
  useEffect(() => {
    return () => {
      logEvent('COMPONENT_UNMOUNTING', {
        hasActiveUpload: uploadStatus === 'uploading'
      });
      
      cleanupBlobUrl();
      
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      
      // Don't clean up on unmount - let the server handle any ongoing uploads
    };
  }, [uploadStatus, logEvent, cleanupBlobUrl]);

  // Validate file before processing
  const validateFile = useCallback((file) => {
    if (!file) return "No file selected";
    
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    
    if (!Object.keys(SUPPORTED_FORMATS).includes(file.type)) {
      return "Unsupported file format. Please use MP4, MOV, or MKV";
    }
    
    return null;
  }, []);

  // Detect if a file is likely from a network path
  const isNetworkPath = useCallback((file) => {
    // Check for common indicators of network paths
    // 1. File access time is significantly slower than local files
    // 2. Check filename for network path patterns
    
    // Check filename for UNC path patterns (Windows network shares)
    const filename = file.name || '';
    const path = file.path || '';
    
    // Look for patterns like \\server\share or //server/share in the path if available
    const networkPathRegex = /^(\\\\|\/\/)[^\\\/]+[\\\/][^\\\/]+/;
    
    if (path && networkPathRegex.test(path)) {
      return true;
    }
    
    // If we can't directly detect it, we'll use a performance measurement
    // to estimate if it's a network file
    return false;
  }, []);

  // Handle file selection with validation and optimized processing
  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset previous state
    setFileError(null);
    setIsProcessing(true);
    setFileProcessed(false);
    
    // Validate file
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setIsProcessing(false);
      return;
    }
    
    // Check if file is from a network path
    const networkFile = isNetworkPath(file);
    if (networkFile) {
      console.log('Network file detected, using optimized handling');
      // For network files, we'll skip blob URL creation and thumbnail generation
      // to prevent UI blocking
      
      setSelectedFile(file);
      setTitle(file.name.split('.')[0]);
      setIsProcessing(false);
      setFileProcessed(true);
      
      // Show a warning about network files
      setFileError("Network file detected. Upload may be slower. Consider copying to local drive first for better performance.");
      return;
    }
    
    // Set a timeout to prevent UI blocking perception
    processingTimeoutRef.current = setTimeout(() => {
      try {
        // Only create a new blob URL if we don't already have one for this file
        if (blobUrlRef.current) {
          cleanupBlobUrl(); // Cleanup old blob
        }
        
        setSelectedFile(file);
        setTitle(file.name.split('.')[0]);
        setFileProcessed(true);
        setIsProcessing(false);
      } catch (error) {
        console.error('Error processing file:', error);
        setSelectedFile(file);
        setTitle(file.name.split('.')[0]);
        setFileProcessed(true);
        setIsProcessing(false);
      }
    }, 50);
  }, [cleanupBlobUrl, validateFile, isNetworkPath]);

  // Memoize handlers
  const handleDrop = useCallback((files) => {
    // ... drop handling logic ...
  }, []);

  // Upload handling - optimized
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate again before upload
    if (!selectedFile || !user || !username) {
      logEvent('UPLOAD_VALIDATION_FAILED', {
        hasFile: !!selectedFile,
        isLoggedIn: !!user,
        hasUsername: !!username
      });
      alert('Please ensure you are logged in and have selected a file');
      return;
    }
    
    const error = validateFile(selectedFile);
    if (error) {
      setFileError(error);
      return;
    }

    logEvent('UPLOAD_INITIATED', {
      title,
      game,
      visibility,
      fileInfo: selectedFile ? {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      } : null
    });

    // Set up the UI for upload
    setShowProgress(true);
    logEvent('PROGRESS_MODAL_OPENED');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${username}_${Date.now()}_${game.replace(/\s+/g, '_')}.${fileExt}`;
      
      logEvent('UPLOAD_STARTED', {
        fileName,
        fileExtension: fileExt
      });

      // Get upload URL from Cloudflare
      console.log(`[Frontend-Init-2] Requesting upload URL from server via /api/copy-to-stream`);
      const response = await fetch('/api/copy-to-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          game,
          visibility,
          username,
          fileName
        })
      });

      console.log(`[Frontend-Init-3] Server response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(`[Frontend-Error] Failed to get upload URL:`, errorData);
        throw new Error(errorData.error || `Failed to get upload URL: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Frontend-Init-4] Received upload URL and UID from server:`, { 
        uid: data.uid,
        success: data.success
      });
      const { uploadUrl, uid } = data;
      
      // Set the current upload UID here so we have it if the user cancels
      currentUploadUid.current = uid;

      // Upload the file to Cloudflare - this is the step that should take time and show progress
      console.log(`[Frontend-Upload] Starting actual file upload to Cloudflare`);
      await uploadWithUrl(selectedFile, uploadUrl, uid);
      console.log(`[Frontend-Upload] File upload completed successfully`);

      logEvent('UPLOAD_COMPLETED', {
        uid: uid,
        duration: `${Date.now() - new Date()}ms`
      });
      
      // Show success state before auto-closing
      console.log(`[Frontend-Upload] Showing success state before auto-closing`);
      setLocalUploadStatus('success');
      
      // Auto-close will be handled by the UploadProgress component
      
    } catch (error) {
      if (error.message === 'Upload cancelled') {
        logEvent('UPLOAD_CANCELLED', {
          reason: 'User initiated',
          stage: 'during_upload'
        });
      } else {
        logEvent('UPLOAD_FAILED', {
          error: error.message,
          stack: error.stack
        });
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
      }
    }
  };

  // Handle successful upload without cancellation
  const handleSuccess = useCallback(() => {
    // First log the current UID for debugging
    console.log(`handleSuccess called, current upload UID: ${currentUploadUid.current}`);
    
    // Now it's safe to reset the UID since the upload is complete
    currentUploadUid.current = null;
    console.log('currentUploadUid cleared after successful upload');
    
    // Reset all form fields and states
    setTitle('');
    setGame('');
    setVisibility('public');
    setSelectedFile(null);
    cleanupBlobUrl();
    setPreviewUrl(null);
    resetForm();
    setShowProgress(false);
    setFileError(null);
    setFileProcessed(false);
    setLocalUploadStatus('idle');
    setBannerKey(prev => prev + 1); // Force banner refresh
    
    // Force refresh the uploads banner using the global function
    if (typeof window.forceRefreshUploads === 'function') {
      console.log('Directly calling forceRefreshUploads after successful upload');
      window.forceRefreshUploads();
    } else {
      // Fallback to the custom event if the global function isn't available
      console.log('Using refreshUploads event as fallback');
      window.dispatchEvent(new CustomEvent('refreshUploads'));
    }
    
    logEvent('UPLOAD_SUCCESS_COMPLETE', {
      bannerRefreshTriggered: true,
      usingDirectMethod: typeof window.forceRefreshUploads === 'function'
    });
  }, [resetForm, cleanupBlobUrl, logEvent]);

  // Improved cancel upload handler - This is the ONLY place we should call the cleanup API
  const handleCancelUpload = useCallback(async () => {
    try {
      console.log('Cancel upload triggered!'); // Add logging to confirm function is called
      
      // First cancel the XHR upload
      await cancelUpload();
      
      // Clean up the current upload UID - ONLY when user explicitly cancels
      if (currentUploadUid.current) {
        try {
          console.log(`Deleting video with UID: ${currentUploadUid.current}`);
          
          // Use the new delete-video API to properly clean up from both Cloudflare and database
          const response = await fetch('/api/cloudflare/delete-video', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              videoUid: currentUploadUid.current,
              userId: user?.id
            }),
          });
          
          const responseData = await response.json().catch(() => ({}));
          console.log('Delete video API response:', responseData);
          
          if (response.ok) {
            logEvent('CANCEL_CLEANUP_COMPLETED', { 
              uid: currentUploadUid.current,
              method: 'delete-video API'
            });
          } else {
            // Fallback to old method if new API fails
            console.warn('New delete API failed, falling back to legacy endpoint');
            await fetch(`/api/copy-to-stream?uid=${currentUploadUid.current}&status=cancelled`, {
              method: 'DELETE'
            });
            logEvent('CANCEL_CLEANUP_COMPLETED', { 
              uid: currentUploadUid.current,
              method: 'legacy DELETE endpoint'
            });
          }
        } catch (error) {
          console.error('Error during cancel cleanup:', error);
          logEvent('CANCEL_CLEANUP_FAILED', { 
            uid: currentUploadUid.current,
            error: error.message
          });
        } finally {
          // Clear the UID after clean up attempt regardless of success/fail
          const previousUid = currentUploadUid.current;
          currentUploadUid.current = null;
          console.log(`Cleared currentUploadUid after cancel: previous value was ${previousUid}`);
        }
      } else {
        console.log('No upload UID to clean up');
      }
      
      // Clean up preview if exists
      cleanupBlobUrl();
      setPreviewUrl(null);
      // Reset form fields
      setTitle('');
      setGame('');
      setVisibility('public');
      setSelectedFile(null);
      setShowProgress(false);
      setFileError(null);
      setFileProcessed(false);
      
      // Force banner refresh after cancellation
      setBannerKey(prev => prev + 1);
      if (typeof window.forceRefreshUploads === 'function') {
        window.forceRefreshUploads();
      } else {
        window.dispatchEvent(new CustomEvent('refreshUploads'));
      }
      
      // Update uploadStatus to show cancellation in UI
      resetForm();
      
    } catch (error) {
      console.error('Error canceling upload:', error);
    }
  }, [cancelUpload, cleanupBlobUrl, logEvent, user, resetForm]);

  // Connection monitoring effect - Simplified
  useEffect(() => {
    const handleOnline = () => {
      logEvent('CONNECTION_RESTORED');
    };

    const handleOffline = async () => {
      logEvent('CONNECTION_LOST');
      if (uploadStatus === 'uploading') {
        logEvent('CONNECTION_LOSS_DURING_UPLOAD');
        await handleCancelUpload();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uploadStatus, handleCancelUpload, logEvent]);

  // Page visibility and unload handling - optimized
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploadStatus === 'uploading' || localUploadStatus === 'uploading') {
        logEvent('PAGE_CLOSE_ATTEMPTED_DURING_UPLOAD');
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
        
        // Don't clean up here - we want the server to handle the upload
      }
    };

    const handleVisibilityChange = () => {
      // Don't clean up on visibility change - let the server handle it
    };

    const handleRouteChange = async () => {
      if (uploadStatus === 'uploading' || localUploadStatus === 'uploading') {
        const confirm = window.confirm('Upload in progress. Are you sure you want to leave?');
        if (!confirm) {
          router.events.emit('routeChangeError');
          throw 'routeChange aborted';
        } else {
          // If user confirms leaving, directly call delete-video API
          if (currentUploadUid.current) {
            logEvent('PAGE_NAVIGATION_DURING_UPLOAD', { 
              confirmed: true,
              cleanup: 'delete-video API',
              uid: currentUploadUid.current
            });
            
            try {
              // Cancel the upload using the hook's cancelUpload function
              await cancelUpload();
              
              // Call delete-video API directly
              const response = await fetch('/api/cloudflare/delete-video', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  videoUid: currentUploadUid.current,
                  userId: user?.id
                }),
              });
              
              if (response.ok) {
                console.log(`Cleanup successful when leaving page: ${currentUploadUid.current}`);
              } else {
                console.warn(`Cleanup failed when leaving page: ${currentUploadUid.current}`);
              }
              
              // Clear the UID
              currentUploadUid.current = null;
            } catch (error) {
              console.error('Error cleaning up during navigation:', error);
            }
          }
        }
      }
      // Don't clean up if not uploading
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [uploadStatus, handleCancelUpload, router, logEvent]);

  // Fetch username from users table - with error handling
  useEffect(() => {
    const fetchUsername = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching username:', error);
        } else if (data) {
          setUsername(data.username);
        }
      } catch (err) {
        console.error('Error in fetchUsername:', err);
      }
    };

    fetchUsername();
  }, [user, supabase]);

  // Optimized file drop handler
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) {
      logEvent('FILE_DROP_REJECTED', { reason: 'No file provided' });
      return;
    }

    // Reset error state
    setFileError(null);
    setIsProcessing(true);
    setFileProcessed(false);
    
    // Validate file
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      logEvent('FILE_VALIDATION_FAILED', { error });
      setIsProcessing(false);
      return;
    }

    // Check if file is from a network path
    const networkFile = isNetworkPath(file);
    if (networkFile) {
      logEvent('NETWORK_FILE_DETECTED', { 
        fileName: file.name,
        fileSize: file.size
      });
      
      // For network files, we'll skip blob URL creation and thumbnail generation
      setSelectedFile(file);
      setTitle(file.name.split('.')[0]);
      setIsProcessing(false);
      setFileProcessed(true);
      
      // Show a warning about network files
      setFileError("Network file detected. Upload may be slower. Consider copying to local drive first for better performance.");
      return;
    }

    logEvent('FILE_SELECTED', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Clean up previous preview
    if (blobUrlRef.current) {
      cleanupBlobUrl();
      logEvent('PREVIEW_CLEANUP');
    }

    // Use setTimeout to prevent UI blocking
    processingTimeoutRef.current = setTimeout(() => {
      setSelectedFile(file);
      setTitle(file.name.split('.')[0]);
      setFileProcessed(true);
      logEvent('FILE_PREPARED', { 
        title: file.name.split('.')[0],
        readyForUpload: true 
      });
      setIsProcessing(false);
    }, 50);
  }, [cleanupBlobUrl, logEvent, validateFile, isNetworkPath]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_FORMATS,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE
  });

  const handleCloseProgress = useCallback(() => {
    // Only close if not uploading
    console.log(`[CloseProgress] Called with uploadStatus: ${uploadStatus}, localUploadStatus: ${localUploadStatus}`);
    
    if (uploadStatus !== 'uploading' && localUploadStatus !== 'uploading') {
      console.log('[CloseProgress] Closing modal and resetting state');
      setShowProgress(false);
      setLocalUploadStatus('idle');
      resetForm();
    } else {
      console.log('[CloseProgress] Cannot close while uploading');
    }
  }, [uploadStatus, localUploadStatus, resetForm]);

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Upload Gaming Clips | Share Your Best Moments | Merrouch Gaming</title>
        <meta name="description" content="Upload and share your best gaming moments from your sessions at Merrouch Gaming Center. Show off your skills and connect with the gaming community." />
      </Head>
      <div className={styles.uploadMain}>
        {user && <PendingUploadsBanner userId={user.id} key={bannerKey} />}
        
        <div className={styles.uploadCard}>
          <header className={styles.header}>
            <MdGamepad className={styles.gameIcon} />
            <h1>Upload Your Highlight</h1>
          </header>

          <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${fileError ? styles.dropzoneError : ''}`}>
            <input {...getInputProps()} />
            {isProcessing ? (
              <div className={styles.processingContainer}>
                <div className={styles.spinner}></div>
                <p>Processing file...</p>
              </div>
            ) : selectedFile ? (
              <div className={styles.previewContainer}>
                <VideoThumbnail 
                  file={selectedFile}
                  onThumbnailGenerated={(url) => {
                    // Only set the preview URL if we don't already have one
                    if (!previewUrl) {
                      setPreviewUrl(url);
                    }
                  }}
                  onError={(error) => {
                    // Just log the error, don't show it to the user
                    console.log('Thumbnail generation skipped, using fallback');
                  }}
                />
                <p className={styles.fileName}>
                  {selectedFile.name} ({Math.round(selectedFile.size / (1024 * 1024))}MB)
                </p>
              </div>
            ) : (
              <div className={styles.dropzoneContent}>
                {fileError ? (
                  <>
                    <MdWarning className={styles.errorIcon} />
                    <p className={styles.errorText}>{fileError}</p>
                  </>
                ) : (
                  <>
                    <MdCloudUpload className={styles.uploadIcon} />
                    <p>{isDragActive ? 'Drop your video here' : 'Drag and drop your video here, or click to browse'}</p>
                    <span className={styles.supportedFormats}>
                      MP4, MOV, or MKV • Max 100MB
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className={styles.uploadForm}>
            <div className={styles.formGroup}>
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Give your clip a title"
                className={styles.input}
                required
                disabled={isProcessing}
              />
            </div>

            <div className={styles.formGroup}>
              <select
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className={styles.select}
                required
                disabled={isProcessing}
              >
                <option value="">Select Game</option>
                <option value="Counter-Strike 2">Counter-Strike 2</option>
                <option value="Valorant">Valorant</option>
                <option value="League of Legends">League of Legends</option>
                <option value="Fortnite">Fortnite</option>
                <option value="Call of Duty">Call of Duty</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <div className={styles.visibilityOptions}>
                <label 
                  className={`${styles.visibilityOption} ${visibility === 'public' ? styles.selected : ''}`}
                  onClick={() => !isProcessing && setVisibility('public')}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className={styles.radioInput}
                    disabled={isProcessing}
                  />
                  <MdPublic className={styles.visibilityIcon} />
                  <div className={styles.visibilityText}>
                    <span>Public</span>
                    <small>Anyone can watch this clip</small>
                  </div>
                </label>

                <label 
                  className={`${styles.visibilityOption} ${visibility === 'private' ? styles.selected : ''}`}
                  onClick={() => !isProcessing && setVisibility('private')}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className={styles.radioInput}
                    disabled={isProcessing}
                  />
                  <MdLock className={styles.visibilityIcon} />
                  <div className={styles.visibilityText}>
                    <span>Private</span>
                    <small>Only you can watch this clip</small>
                  </div>
                </label>
              </div>
            </div>

            <button 
              type="submit"
              className={styles.uploadButton}
              disabled={!selectedFile || uploadStatus === 'uploading' || isProcessing || fileError}
            >
              Upload Clip
            </button>

            <button 
              type="button"
              onClick={() => router.push('/dashboard')}
              className={styles.backButton}
              disabled={uploadStatus === 'uploading'}
            >
              Back to Dashboard
            </button>
          </form>
        </div>
      </div>
      
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingContent}>
            <div className={styles.spinner}></div>
            <p>Processing file...</p>
          </div>
        </div>
      )}
      
      <UploadProgress
        progress={uploadProgress}
        isOpen={showProgress}
        onClose={handleCloseProgress}
        status={localUploadStatus !== 'idle' ? localUploadStatus : uploadStatus}
        onCancel={() => {
          console.log('Cancel button clicked from UploadProgress');
          console.log(`Current upload UID when cancelling: ${currentUploadUid.current}`);
          handleCancelUpload();
        }}
        onReset={handleSuccess}
        title={title}
        game={game}
        allowClose={uploadStatus !== 'uploading' && localUploadStatus !== 'uploading'}
        isNetworkFile={fileError && fileError.includes("Network file")}
      />
    </ProtectedPageWrapper>
  );
}

export default UploadPage;