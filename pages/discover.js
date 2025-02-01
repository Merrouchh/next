import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Discover.module.css';
import { MdArrowBack, MdPerson, MdGames, MdFavorite, MdFavoriteBorder, MdShare } from 'react-icons/md';
import { createClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';

const Discover = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState([]);
  const [likedClips, setLikedClips] = useState({});
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const CLIPS_PER_PAGE = 5;
  const loaderRef = useRef(null);

  // Fetch user likes
  const fetchUserLikes = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select('clip_id, clips(likes_count)')
        .eq('user_id', user.id);

      if (error) throw error;

      const likes = {};
      data.forEach(like => {
        likes[like.clip_id] = true;
      });
      setLikedClips(likes);
    } catch (err) {
      console.error('Error fetching likes:', err);
    }
  }, [user, supabase]);

  // Fetch clips
  const fetchClips = useCallback(async () => {
    try {
      let query = supabase
        .from('clips')
        .select('*')
        .eq('visibility', 'public')
        .order('uploaded_at', { ascending: false })
        .range(page * CLIPS_PER_PAGE, (page + 1) * CLIPS_PER_PAGE - 1);

      const { data, error } = await query;

      if (error) throw error;

      const clipsWithUrls = await Promise.all(data.map(async (clip) => {
        if (!clip?.file_path) return null;
        
        const { data: videoData } = supabase.storage
          .from('highlight-clips')
          .getPublicUrl(clip.file_path);

        let thumbnailUrl = null;
        if (clip.thumbnail_path) {
          const { data: thumbnailData } = supabase.storage
            .from('highlight-clips')
            .getPublicUrl(clip.thumbnail_path);
          thumbnailUrl = thumbnailData?.publicUrl;
        }
        
        return {
          ...clip,
          url: videoData?.publicUrl,
          thumbnailUrl
        };
      }));

      const validClips = clipsWithUrls.filter(Boolean);
      setClips(prev => page === 0 ? validClips : [...prev, ...validClips]);
      setHasMore(validClips.length === CLIPS_PER_PAGE);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching clips:', err);
      setLoading(false);
    }
  }, [page, supabase]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchUserLikes();
    }
  }, [user, fetchUserLikes]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleLike = async (clipId) => {
    if (!user) {
      setIsTransitioning(true);
      router.push('/').finally(() => setIsTransitioning(false));
      return;
    }

    try {
      const isLiked = likedClips[clipId];
      
      setLikedClips(prev => ({
        ...prev,
        [clipId]: !isLiked
      }));

      setClips(prev => prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            likes_count: (clip.likes_count || 0) + (isLiked ? -1 : 1)
          };
        }
        return clip;
      }));

      if (isLiked) {
        const { error: unlikeError } = await supabase
          .from('video_likes')
          .delete()
          .match({ user_id: user.id, clip_id: clipId });

        if (unlikeError) throw unlikeError;
      } else {
        const { error: likeError } = await supabase
          .from('video_likes')
          .insert({ user_id: user.id, clip_id: clipId });

        if (likeError) throw likeError;
      }

      const { error: updateError } = await supabase
        .from('clips')
        .update({ 
          likes_count: clips.find(c => c.id === clipId).likes_count + (isLiked ? -1 : 1)
        })
        .eq('id', clipId);

      if (updateError) throw updateError;

    } catch (err) {
      console.error('Error updating like:', err);
      setLikedClips(prev => ({
        ...prev,
        [clipId]: isLiked
      }));

      setClips(prev => prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            likes_count: (clip.likes_count || 0) + (isLiked ? 1 : -1)
          };
        }
        return clip;
      }));
    }
  };

  const handleShare = async (clip) => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      await navigator.share({
        title: clip.title || 'Gaming Clip',
        text: `Check out this gaming clip by ${clip.username}!`,
        url: clipUrl
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // Add infinite scroll effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (authLoading || (loading && page === 0) || isTransitioning) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Discover - Merrouch Gaming</title>
        <meta name="description" content="Discover amazing gaming moments" />
      </Head>

      <main className={styles.discoverMain}>
        <div className={styles.feedContainer}>
          {user && (
            <div className={styles.navigationButtons}>
              <button
                onClick={() => {
                  setIsTransitioning(true);
                  router.push(`/profile/${user.username}`).finally(() => setIsTransitioning(false));
                }}
                className={styles.navButton}
              >
                <MdArrowBack />
                My Clips
              </button>
            </div>
          )}
          {clips.map((clip) => clip && (
            <div key={clip.id} className={styles.clipContainer}>
              <div 
                onClick={() => router.push(`/clip/${clip.id}`)}
                className={styles.clipInfo}
              >
                <div className={styles.clipHeader}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/profile/${clip.username}`);
                    }}
                    className={styles.userLink}
                    type="button"
                  >
                    <MdPerson />
                    <span>{clip.username}</span>
                  </button>
                  {clip.game && (
                    <span className={styles.gameTag}>
                      <MdGames />
                      {clip.game}
                    </span>
                  )}
                </div>

                {clip.title && <h3 className={styles.clipTitle}>{clip.title}</h3>}
              </div>

              <div className={styles.clipVideoWrapper}>
                <video 
                  className={styles.clipVideo} 
                  controls 
                  playsInline
                  poster={clip.thumbnailUrl || undefined}
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                >
                  <source src={clip.url} type="video/mp4" />
                </video>
              </div>

              <div 
                className={styles.clipActions}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={() => handleLike(clip.id)}
                  className={`${styles.actionButton} ${likedClips[clip.id] ? styles.liked : ''}`}
                >
                  {likedClips[clip.id] ? <MdFavorite /> : <MdFavoriteBorder />}
                  <span>{clip.likes_count || 0}</span>
                </button>
                <button 
                  onClick={() => handleShare(clip)}
                  className={styles.actionButton}
                >
                  <MdShare />
                </button>
              </div>
            </div>
          ))}
          {hasMore && (
            <div ref={loaderRef} className={styles.loader}>
              <div className={styles.spinner}>Loading more...</div>
            </div>
          )}
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default Discover;