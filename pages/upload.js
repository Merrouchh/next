import { useState, useCallback, useRef, useEffect } from 'react';
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

// Dynamically import the VideoThumbnail component with no SSR
const VideoThumbnail = dynamic(() => import('../components/VideoThumbnail'), {
  ssr: false,
  loading: () => (
    <div className={styles.previewLoading}>
      <div className={styles.spinner}></div>
      <p>Preparing preview... sbar</p>
    </div>
  )
});

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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error, cancelled
  const { user, isLoggedIn, supabase } = useAuth();
  const router = useRouter();
  const xhrRef = useRef(null);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [username, setUsername] = useState(null);

  // Wrap fetchPendingUploads in useCallback
  const fetchPendingUploads = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('media_clips')
      .select('id, title, game, status, queue_number')
      .in('status', ['uploaded', 'processing', 'completed'])
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending uploads:', error);
      return;
    }

    console.log('Fetched pending uploads:', data);
    setPendingUploads(data);
  }, [user, supabase]);

  // Wrap handleCancelUpload in useCallback
  const handleCancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setUploadStatus('cancelled');
    }
    // Clear all fields
    setTitle('');
    setGame('');
    setVisibility('public');
    // Clean up video preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSelectedFile(null);
    setUploadProgress(0);
    setShowProgress(false);
  }, [previewUrl]);

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

  // Handle page navigation/close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (uploadStatus === 'uploading') {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Are you sure you want to leave?';
      }
    };

    const handleRouteChange = () => {
      if (uploadStatus === 'uploading') {
        const confirm = window.confirm('Upload in progress. Are you sure you want to leave?');
        if (!confirm) {
          router.events.emit('routeChangeError');
          throw 'routeChange aborted';
        } else {
          handleCancelUpload();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [uploadStatus, router, handleCancelUpload]);

  // Subscribe to changes effect
  useEffect(() => {
    fetchPendingUploads();

    const subscription = supabase
      .channel('media_clips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_clips',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchPendingUploads();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, supabase, fetchPendingUploads]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Clean up previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setTitle(file.name.split('.')[0]);
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-matroska': ['.mkv']
    },
    maxFiles: 1
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a video file');
      return;
    }

    if (!user) {
      alert('You must be logged in to upload');
      return;
    }

    // Check if username is fetched
    if (!username) {
      alert('Username not found. Please try again.');
      return;
    }

    setUploadStatus('uploading');
    setShowProgress(true);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    const metadata = {
      title,
      game,
      visibility,
      username
    };
    formData.append('metadata', JSON.stringify(metadata));

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded * 100) / event.total);
        setUploadProgress(progress);
      }
    };

    xhr.onload = () => {
      try {
        const response = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && response.clip) {
          setUploadStatus('success');
          setUploadProgress(100);
          
          // Reset form after successful upload
          setTimeout(() => {
            // Reset all form fields
            setTitle('');
            setGame('');
            setVisibility('public');
            setSelectedFile(null);
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
            }
            setUploadProgress(0);
            setShowProgress(false);
            setUploadStatus('idle');
          }, 2000); // Wait 2 seconds to show success message before closing
        } else {
          console.error('Upload failed:', response.error || 'Unknown error');
          setUploadStatus('error');
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        setUploadStatus('error');
      }
    };

    xhr.onerror = () => {
      console.error('Network error during upload');
      setUploadStatus('error');
    };

    xhr.onabort = () => {
      console.log('Upload cancelled by user');
      setUploadStatus('cancelled');
    };

    xhr.open('POST', '/api/upload', true);
    xhr.send(formData);
  };

  const handleCloseProgress = () => {
    if (uploadStatus !== 'uploading') {
      setShowProgress(false);
      setUploadProgress(0);
      setUploadStatus('idle');
    }
  };

  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
      // Clean up any file previews
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Upload Gaming Highlight</title>
        <meta name="description" content="Upload your gaming highlights" />
      </Head>

      <main className={styles.uploadMain}>
        <PendingUploadsBanner pendingUploads={pendingUploads} />
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
                onChange={(e) => setTitle(e.target.value)}
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

        <UploadProgress
          progress={uploadProgress}
          isOpen={showProgress}
          onClose={handleCloseProgress}
          status={uploadStatus}
          onCancel={handleCancelUpload}
          title={title}
          game={game}
        />
      </main>
    </ProtectedPageWrapper>
  );
}

export default UploadPage;