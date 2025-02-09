import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import styles from '../styles/Discover.module.css';
import { createClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import VideoPlayer from '../components/VideoPlayer';
import { useClipsFeed } from '../hooks/useClipsFeed';
import LoadingClip from '../components/LoadingClip';
import DynamicMeta from '../components/DynamicMeta';
import { createClient as createServerClient } from '../utils/supabase/server-props';

export async function getServerSideProps({ req, res }) {
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient({ req, res });

  try {
    // Check session server-side
    const { data: { session } } = await supabase.auth.getSession();

    // Get latest clips for initial render and meta preview
    const { data: latestClips, error } = await supabase
      .from('clips')
      .select(`
        id, 
        thumbnail_path, 
        title, 
        username, 
        game, 
        user_id, 
        visibility, 
        likes_count, 
        views_count,
        file_path,
        uploaded_at
      `)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    // Get a featured clip for the preview image
    const featuredClip = latestClips?.[0];
    const timestamp = Date.now();
    const previewImage = featuredClip?.thumbnail_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${featuredClip.thumbnail_path}?t=${timestamp}`
      : 'https://merrouchgaming.com/top.jpg';

    const description = featuredClip
      ? `Watch the latest gaming highlights at Merrouch Gaming! Featured: ${featuredClip.title} - an amazing ${featuredClip.game} clip by ${featuredClip.username}. Join our gaming community and share your best moments.`
      : 'Explore amazing gaming moments from the Merrouch Gaming community. Watch, share, and discover gaming highlights from your favorite games.';

    return {
      props: {
        initialSession: session,
        initialClips: latestClips || [],
        metaData: {
          title: 'Discover Gaming Clips | Merrouch Gaming',
          description,
          image: previewImage,
          url: 'https://merrouchgaming.com/discover',
          type: 'website',
          openGraph: {
            title: 'Discover Gaming Clips | Merrouch Gaming',
            description,
            images: [
              {
                url: previewImage,
                width: 1200,
                height: 630,
                alt: featuredClip ? `${featuredClip.game} gameplay by ${featuredClip.username}` : 'Merrouch Gaming Clips',
              },
            ],
            site_name: 'Merrouch Gaming',
          },
          twitter: {
            card: 'summary_large_image',
            site: '@merrouchgaming',
            title: 'Discover Gaming Clips | Merrouch Gaming',
            description,
            image: previewImage,
          }
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        initialSession: null,
        initialClips: [],
        error: 'Error loading clips',
        metaData: {
          title: 'Discover | Merrouch Gaming',
          description: 'Explore gaming clips at Merrouch Gaming',
          url: 'https://merrouchgaming.com/discover',
          type: 'website',
          image: 'https://merrouchgaming.com/top.jpg'
        }
      }
    };
  }
}

const Discover = ({ initialClips, metaData }) => {
  const [isTransitioning] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRefs = useRef(new Map());
  
  const { 
    clips, 
    loading: clipsLoading, 
    hasMore, 
    loaderRef,
    updateClipCount,
    setClips
  } = useClipsFeed(supabase, 12, null, false, initialClips);

  // Reset player state on unmount
  useEffect(() => {
    // Store ref in a variable at effect execution time
    const playersRef = playerRefs.current;

    return () => {
      setPlayingVideoId(null);
      setIsPlayerReady(false);
      // Use stored ref in cleanup
      if (playersRef) {
        playersRef.clear();
      }
    };
  }, []);

  // Clean up players
  useEffect(() => {
    // Create a snapshot of current players at effect execution time
    const players = new Map(playerRefs.current);
    const playersRef = playerRefs.current;

    return () => {
      // Use snapshot for player cleanup
      players.forEach((player) => {
        try {
          if (player?.destroy) {
            player.destroy();
          }
        } catch (err) {
          console.error('Error cleaning up player:', err);
        }
      });
      
      // Use stored ref for final cleanup
      if (playersRef) {
        playersRef.clear();
      }
    };
  }, []); // No dependencies needed since we're using snapshots

  // Handle player initialization
  const handlePlayerInit = useCallback((clipId, playerInstance) => {
    playerRefs.current.set(clipId, playerInstance);
  }, []);

  // Handle player ready state
  const handlePlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  const handlePlay = useCallback((clipId) => {
    if (!isPlayerReady) return;
    
    // Only pause other players if this is a new video playing
    if (playingVideoId !== clipId) {
      playerRefs.current.forEach((player, id) => {
        if (id !== clipId) {
          try {
            player?.pause?.();
          } catch (err) {
            console.error('Error pausing player:', err);
          }
        }
      });
      setPlayingVideoId(clipId);
    }
  }, [isPlayerReady, playingVideoId]);

  const handleClipUpdate = useCallback((updatedClip) => {
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === updatedClip.id ? updatedClip : clip
      )
    );
  }, [setClips]);

  // Add this effect to handle initial loading
  useEffect(() => {
    let mounted = true;

    const initializeVideos = async () => {
      try {
        if (mounted) {
          // No need to setLoading(false) here, as clipsLoading handles it
        }
      } catch (error) {
        console.error('Error initializing videos:', error);
      }
    };

    if (clips.length > 0) {
      initializeVideos();
    }

    return () => {
      mounted = false;
    };
  }, [clips]);

  // Loading content component
  const LoadingContent = () => (
    <main className={styles.discoverMain}>
      <div className={styles.feedContainer}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={styles.clipWrapper}>
            <LoadingClip />
          </div>
        ))}
      </div>
    </main>
  );

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      {authLoading || (clipsLoading && clips.length === 0) || isTransitioning ? (
        <LoadingContent />
      ) : (
        <main className={styles.discoverMain}>
          <div className={styles.feedContainer}>
            {/* Use a Set to ensure unique clips */}
            {Array.from(new Set(clips.map(clip => clip.id))).map(clipId => {
              const clip = clips.find(c => c.id === clipId);
              return clip && (
                <div key={clipId} className={styles.clipWrapper}>
                  <VideoPlayer
                    clip={clip}
                    user={user}
                    supabase={supabase}
                    light={true}
                    playing={playingVideoId === clip.id}
                    onPlay={() => handlePlay(clip.id)}
                    onPlayerInit={(player) => handlePlayerInit(clip.id, player)}
                    onReady={handlePlayerReady}
                    onViewCountUpdate={(clipId, newCount) => 
                      updateClipCount(clipId, 'views_count', newCount)
                    }
                    onLikeUpdate={(clipId, newCount) => 
                      updateClipCount(clipId, 'likes_count', newCount)
                    }
                    isOwner={user && clip.user_id === user.id}
                    onClipUpdate={handleClipUpdate}
                    playsInline
                  />
                </div>
              );
            })}

            {hasMore && (
              <div 
                ref={loaderRef} 
                className={styles.loader}
                style={{ height: '20px', margin: '20px 0' }}
              >
                <div className={styles.spinner} />
              </div>
            )}
          </div>
        </main>
      )}
    </ProtectedPageWrapper>
  );
};

export default Discover;