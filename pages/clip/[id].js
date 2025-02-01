import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import styles from '../../styles/Clip.module.css';
import LoadingScreen from '../../components/LoadingScreen';
import { MdPerson, MdGames, MdFavorite, MdFavoriteBorder, MdShare, MdContentCopy, MdLock } from 'react-icons/md';
import LoginModal from '../../components/LoginModal';

// Add getServerSideProps for initial data fetch
export async function getServerSideProps(context) {
  const { id } = context.params;
  const supabase = createServerClient(context);

  try {
    const { data: clipData, error: clipError } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    if (clipError) throw clipError;

    if (!clipData) {
      return {
        props: {
          error: 'Clip not found'
        }
      };
    }

    // Get video URL
    const { data: videoData } = supabase.storage
      .from('highlight-clips')
      .getPublicUrl(clipData.file_path);

    // Get thumbnail URL if it exists
    let thumbnailUrl = null;
    if (clipData.thumbnail_path) {
      const { data: thumbnailData } = supabase.storage
        .from('highlight-clips')
        .getPublicUrl(clipData.thumbnail_path);
      thumbnailUrl = thumbnailData?.publicUrl;
    }

    return {
      props: {
        initialClip: {
          ...clipData,
          url: videoData?.publicUrl,
          thumbnailUrl: thumbnailUrl || videoData?.publicUrl
        }
      }
    };
  } catch (error) {
    return {
      props: {
        error: error.message
      }
    };
  }
}

export default function ClipPage({ initialClip, error: initialError }) {
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase, loading: authLoading } = useAuth();
  
  const [clip, setClip] = useState(initialClip);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(!initialClip);
  const [error, setError] = useState(initialError);
  const [copied, setCopied] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Check if the clip is liked by the current user
  const checkIfLiked = async (clipId, userId) => {
    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select('*')
        .eq('user_id', userId)
        .eq('clip_id', parseInt(clipId)); // Convert to integer

      if (error) throw error;
      setIsLiked(data.length > 0);
    } catch (err) {
      console.error('Error checking like status:', err);
    }
  };

  // Fetch clip data
  useEffect(() => {
    const fetchClip = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('clips')
          .select('*')
          .eq('id', parseInt(id)) // Convert to integer
          .single();

        if (error) throw error;

        if (data) {
          // Get video URL
          const { data: videoData } = supabase.storage
            .from('highlight-clips')
            .getPublicUrl(data.file_path);

          // Get thumbnail URL if it exists
          let thumbnailUrl = null;
          if (data.thumbnail_path) {
            const { data: thumbnailData } = supabase.storage
              .from('highlight-clips')
              .getPublicUrl(data.thumbnail_path);
            thumbnailUrl = thumbnailData?.publicUrl;
          }

          setClip({
            ...data,
            url: videoData?.publicUrl,
            thumbnailUrl: thumbnailUrl || videoData?.publicUrl
          });

          // Check like status if user is logged in
          if (user) {
            await checkIfLiked(data.id, user.id);
          }
        }
      } catch (err) {
        console.error('Error fetching clip:', err);
        setError('Failed to load clip');
      } finally {
        setLoading(false);
      }
    };

    fetchClip();
  }, [id, user]);

  const handleLike = async () => {
    if (!user) {
      // Show login modal instead of redirecting
      setIsLoginModalOpen(true);
      return;
    }

    try {
      // Optimistic update
      setIsLiked(prev => !prev);
      
      if (isLiked) {
        // Unlike
        const { error: unlikeError } = await supabase
          .from('video_likes')
          .delete()
          .match({ 
            user_id: user.id, 
            clip_id: parseInt(clip.id) // Convert to integer
          });

        if (unlikeError) throw unlikeError;

        // Update likes count
        await supabase
          .from('clips')
          .update({ 
            likes_count: clip.likes_count - 1 
          })
          .eq('id', parseInt(clip.id)); // Convert to integer

      } else {
        // Like
        const { error: likeError } = await supabase
          .from('video_likes')
          .insert({ 
            user_id: user.id, 
            clip_id: parseInt(clip.id) // Convert to integer
          });

        if (likeError) throw likeError;

        // Update likes count
        await supabase
          .from('clips')
          .update({ 
            likes_count: clip.likes_count + 1 
          })
          .eq('id', parseInt(clip.id)); // Convert to integer
      }

      // Refresh clip data to get updated likes count
      const { data: updatedClip } = await supabase
        .from('clips')
        .select('*')
        .eq('id', parseInt(clip.id)) // Convert to integer
        .single();

      if (updatedClip) {
        setClip(prev => ({
          ...prev,
          likes_count: updatedClip.likes_count
        }));
      }

    } catch (err) {
      console.error('Error updating like:', err);
      // Revert on error
      setIsLiked(prev => !prev);
    }
  };

  // Add copy link functionality
  const handleCopyLink = async () => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.clipboard.writeText(clipUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Add share functionality
  const handleShare = async () => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.share({
        title: clip.title || 'Gaming Clip',
        text: `Check out this gaming clip by ${clip.username}!`,
        url: clipUrl
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading || authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingScreen message="Loading clip..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Go Home</button>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className={styles.notFoundContainer}>
        <h1>Clip Not Found</h1>
        <p>This clip may be private or has been removed.</p>
        <button onClick={() => router.push('/')}>Go Home</button>
      </div>
    );
  }

  if (error === 'private') {
    return (
      <div className={styles.privateContainer}>
        <div className={styles.privateContent}>
          <MdLock className={styles.privateLockIcon} />
          <h1>Private Clip</h1>
          <p>This clip has been set to private by its owner.</p>
          <button onClick={() => router.push('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.clipContainer}>
      <div className={styles.clipHeader}>
        <button 
          onClick={() => router.push(`/profile/${clip.username}`)}
          className={styles.userLink}
        >
          <MdPerson />
          {clip.username}
        </button>
        {clip.game && (
          <div className={styles.gameTag}>
            <MdGames />
            {clip.game}
          </div>
        )}
      </div>

      <h1 className={styles.clipTitle}>{clip.title}</h1>
      
      <div className={styles.videoWrapper}>
        <video 
          controls 
          className={styles.clipVideo}
          playsInline
          poster={clip.thumbnailUrl}
          preload="metadata"
        >
          <source src={clip.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className={styles.clipInfo}>
        <div className={styles.clipActions}>
          <button
            onClick={handleLike}
            className={`${styles.actionButton} ${isLiked ? styles.liked : ''}`}
          >
            {isLiked ? <MdFavorite /> : <MdFavoriteBorder />}
            <span className={styles.likeCount}>{clip.likes_count}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className={`${styles.actionButton} ${copied ? styles.copied : ''}`}
          >
            <MdContentCopy />
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={handleShare}
            className={styles.actionButton}
          >
            <MdShare />
            Share
          </button>
        </div>
      </div>

      {!user && (
        <div className={styles.signInPrompt}>
          <p>Sign in to like and comment on clips</p>
          <button 
            onClick={() => setIsLoginModalOpen(true)} 
            className={styles.signInButton}
          >
            Sign In
          </button>
        </div>
      )}

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
} 