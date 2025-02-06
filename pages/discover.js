import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Discover.module.css';
import { MdArrowBack } from 'react-icons/md';
import { createClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import VideoPlayer from '../components/VideoPlayer';
import { useClipsFeed } from '../hooks/useClipsFeed';
import LoadingClip from '../components/LoadingClip';
import { NextSeo } from 'next-seo';
import DynamicMeta from '../components/DynamicMeta';

const Discover = () => {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [playingVideoId, setPlayingVideoId] = useState(null);
  
  const { 
    clips, 
    loading, 
    hasMore, 
    loaderRef, 
    updateClipCount,
    setClips
  } = useClipsFeed(supabase);

  const handleClipUpdate = useCallback((updatedClip) => {
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === updatedClip.id ? updatedClip : clip
      )
    );
  }, [setClips]);

  const handlePlay = useCallback((clipId) => {
    setPlayingVideoId(clipId);
  }, []);

  if (authLoading || (loading && clips.length === 0) || isTransitioning) {
    return (
      <ProtectedPageWrapper>
        <Head>
          <title>Discover - Merrouch Gaming</title>
        </Head>
        <main className={styles.discoverMain}>
          <div className={styles.feedContainer}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className={styles.clipWrapper}>
                <LoadingClip />
              </div>
            ))}
          </div>
        </main>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta
        title="Gaming Highlights | Merrouch Gaming Center"
        description="Watch the best gaming moments from our community in Tangier. High-quality gameplay clips, eSports highlights, and gaming achievements."
        image="https://merrouchgaming.com/top.jpg"
        url="https://merrouchgaming.com/discover"
        type="website"
      />
      <main className={styles.discoverMain}>
        <div className={styles.feedContainer}>
          {user && (
            <div className={styles.navigationButtons}>
              <button
                onClick={() => {
                  setIsTransitioning(true);
                  router.push(`/profile/${user.username}`).finally(() => setIsTransitioning(false));
                }}
                className={styles.myClipsButton}
              >
                <MdArrowBack className={styles.backIcon} />
                <span>My Clips</span>
              </button>
            </div>
          )}
          
          {clips.map((clip) => clip && (
            <div key={clip.id} className={styles.clipWrapper}>
              <VideoPlayer
                clip={clip}
                user={user}
                supabase={supabase}
                light={true}
                playing={playingVideoId === clip.id}
                onPlay={() => handlePlay(clip.id)}
                onViewCountUpdate={(clipId, newCount) => updateClipCount(clipId, 'views_count', newCount)}
                onLikeUpdate={(clipId, newCount) => updateClipCount(clipId, 'likes_count', newCount)}
                isOwner={user && clip.user_id === user.id}
                onClipUpdate={handleClipUpdate}
              />
            </div>
          ))}

          {hasMore && (
            <div ref={loaderRef} className={styles.loader}>
              <div className={styles.spinner} />
            </div>
          )}
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default Discover;