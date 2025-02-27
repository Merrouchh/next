import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import styles from '../styles/Upload.module.css';
import { MdGamepad, MdPublic, MdLock, MdCloudUpload } from 'react-icons/md';
import Head from 'next/head';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { useDropzone } from 'react-dropzone';
import UploadProgress from '../components/UploadProgress';
import PendingUploadsBanner from '../components/PendingUploadsBanner';
import dynamic from 'next/dynamic';
import { useVideoUpload } from '../hooks/useVideoUpload';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';

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
  const { user, isLoggedIn, supabase } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(null);
  const currentUploadUid = useRef(null);
  const sessionId = useRef(uuidv4()).current;
  const videoRef = useRef(null);
  const blobUrlRef = useRef(null);

  const { 
    uploadStatus, 
    uploadProgress, 
    uploadFile, 
    cancelUpload,
    resetForm 
  } = useVideoUpload();

  // Simplified blob cleanup
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

  // Simplified title change handler - no debounce needed
  const handleTitleChange = useCallback((e) => {
    setTitle(e.target.value);
  }, []);

  // Cleanup on unmount - simplified
  useEffect(() => {
    return () => {
      cleanupBlobUrl();
    };
  }, [cleanupBlobUrl]);

  // Handle file selection
  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      cleanupBlobUrl(); // Cleanup old blob
      try {
        const newBlobUrl = URL.createObjectURL(file);
        blobUrlRef.current = newBlobUrl;
        setPreviewUrl(newBlobUrl);
        setSelectedFile(file);
      } catch (error) {
        console.error('Error creating blob URL:', error);
        // Fallback for Edge
        setSelectedFile(file);
        setPreviewUrl(''); // Will use file directly in video element
      }
    }
  }, [cleanupBlobUrl]);

  // Memoize handlers
  const handleDrop = useCallback((files) => {
    // ... drop handling logic ...
  }, []);

  const logEvent = useCallback((event, details) => {
    // ... logging logic ...
  }, [username, sessionId]);

  // Remove the old handleCancelUpload and use the one from the hook directly
  const handleCancelUpload = useCallback(async () => {
    try {
      await cancelUpload();
      // Clean up preview if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      // Reset form fields
      setTitle('');
      setGame('');
      setVisibility('public');
      setSelectedFile(null);
      setShowProgress(false);
    } catch (error) {
      console.error('Error canceling upload:', error);
    }
  }, [cancelUpload, previewUrl]);

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

  // Page visibility and unload handling
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploadStatus === 'uploading') {
        logEvent('PAGE_CLOSE_ATTEMPTED_DURING_UPLOAD');
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
        
        if (currentUploadUid.current) {
          logEvent('SENDING_CLEANUP_BEACON', {
            uid: currentUploadUid.current
          });
          navigator.sendBeacon(
            `/api/copy-to-stream?uid=${currentUploadUid.current}&status=closed`,
            new Blob([], { type: 'application/json' })
          );
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden' && uploadStatus === 'uploading') {
        if (currentUploadUid.current) {
          try {
            navigator.sendBeacon(
              `/api/copy-to-stream?uid=${currentUploadUid.current}&status=closed`,
              new Blob([], { type: 'application/json' })
            );
          } catch (error) {
            console.error('Error during visibility change cleanup:', error);
          }
        }
      }
    };

    const handleRouteChange = async () => {
      if (uploadStatus === 'uploading') {
        const confirm = window.confirm('Upload in progress. Are you sure you want to leave?');
        if (!confirm) {
          router.events.emit('routeChangeError');
          throw 'routeChange aborted';
        } else {
          await handleCancelUpload();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      router.events.off('routeChangeStart', handleRouteChange);
      
      if (uploadStatus === 'uploading' && currentUploadUid.current) {
        const cleanup = async () => {
          try {
            await fetch(`/api/copy-to-stream?uid=${currentUploadUid.current}&status=closed`, {
              method: 'DELETE'
            });
          } catch (error) {
            console.error('Error during unmount cleanup:', error);
          }
        };
        
        cleanup();
      }
    };
  }, [uploadStatus, handleCancelUpload, router, logEvent]);

  // Fetch username from users table
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

  // File selection logging
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) {
      logEvent('FILE_DROP_REJECTED', { reason: 'No file provided' });
      return;
    }

    logEvent('FILE_SELECTED', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    // Clean up previous preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      logEvent('PREVIEW_CLEANUP', { oldPreviewUrl: previewUrl });
    }

    setSelectedFile(file);
    setTitle(file.name.split('.')[0]);
    logEvent('FILE_PREPARED', { 
      title: file.name.split('.')[0],
      readyForUpload: true 
    });
  }, [previewUrl, logEvent]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-matroska': ['.mkv']
    },
    maxFiles: 1
  });

  const handleCloseProgress = useCallback(() => {
    // Only close if not uploading
    if (uploadStatus !== 'uploading') {
      setShowProgress(false);
      resetForm();
    }
  }, [uploadStatus, resetForm]);

  // Upload handling
  const handleSubmit = async (e) => {
    e.preventDefault();
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

    if (!selectedFile || !user || !username) {
      logEvent('UPLOAD_VALIDATION_FAILED', {
        hasFile: !!selectedFile,
        isLoggedIn: !!user,
        hasUsername: !!username
      });
      alert('Please ensure you are logged in and have selected a file');
      return;
    }

    setShowProgress(true);
    logEvent('PROGRESS_MODAL_OPENED');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${username}_${Date.now()}_${game.replace(/\s+/g, '_')}.${fileExt}`;
      
      logEvent('UPLOAD_STARTED', {
        fileName,
        fileExtension: fileExt
      });

      const uploadedUid = await uploadFile(selectedFile, {
        title,
        game,
        visibility,
        username,
        fileName
      });

      logEvent('UPLOAD_COMPLETED', {
        uid: uploadedUid,
        duration: `${Date.now() - new Date()}ms`
      });

      // Remove the setTimeout and call handleSuccess directly
      handleSuccess();
      
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

  // Clean up unmount effect - Simplified
  useEffect(() => {
    return () => {
      logEvent('COMPONENT_UNMOUNTING', {
        hasActiveUpload: uploadStatus === 'uploading'
      });
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, uploadStatus, logEvent]);

  // Handle successful upload without cancellation
  const handleSuccess = useCallback(() => {
    setTitle('');
    setGame('');
    setVisibility('public');
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    resetForm();
    setShowProgress(false);
  }, [previewUrl, resetForm]);

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Upload Clip - MerrouchGaming</title>
      </Head>
      <div className={styles.uploadMain}>
        <PendingUploadsBanner userId={user?.id} />
        <div className={styles.uploadCard}>
          <header className={styles.header}>
            <MdGamepad className={styles.gameIcon} />
            <h1>Upload Your Highlight</h1>
          </header>

          <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''}`}>
            <input {...getInputProps()} />
            {selectedFile ? (
              <div className={styles.previewContainer}>
                <VideoThumbnail 
                  file={selectedFile}
                  onThumbnailGenerated={(url) => setPreviewUrl(url)}
                  onError={(error) => console.error('Thumbnail error:', error)}
                />
                <p className={styles.fileName}>
                  {selectedFile.name} ({Math.round(selectedFile.size / (1024 * 1024))}MB)
                </p>
              </div>
            ) : (
              <div className={styles.dropzoneContent}>
                <MdCloudUpload className={styles.uploadIcon} />
                <p>{isDragActive ? 'Drop your video here' : 'Drag and drop your video here, or click to browse'}</p>
                <span className={styles.supportedFormats}>
                  MP4, MOV, or MKV • Max 100MB
                </span>
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
              />
            </div>

            <div className={styles.formGroup}>
              <select
                value={game}
                onChange={(e) => setGame(e.target.value)}
                className={styles.select}
                required
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
                  onClick={() => setVisibility('public')}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === 'public'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className={styles.radioInput}
                  />
                  <MdPublic className={styles.visibilityIcon} />
                  <div className={styles.visibilityText}>
                    <span>Public</span>
                    <small>Anyone can watch this clip</small>
                  </div>
                </label>

                <label 
                  className={`${styles.visibilityOption} ${visibility === 'private' ? styles.selected : ''}`}
                  onClick={() => setVisibility('private')}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={(e) => setVisibility(e.target.value)}
                    className={styles.radioInput}
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
              disabled={!selectedFile || uploadStatus === 'uploading'}
            >
              Upload Clip
            </button>

            <button 
              type="button"
              onClick={() => router.push('/dashboard')}
              className={styles.backButton}
            >
              Back to Dashboard
            </button>
          </form>
        </div>
      </div>
      
      <UploadProgress
        progress={uploadProgress}
        isOpen={showProgress}
        onClose={handleCloseProgress}
        status={uploadStatus}
        onCancel={handleCancelUpload}
        onReset={handleSuccess}
        title={title}
        game={game}
        allowClose={uploadStatus !== 'uploading'}
      />
    </ProtectedPageWrapper>
  );
}

export default UploadPage;