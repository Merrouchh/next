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
    'public, s-maxage=300, stale-while-revalidate=60'
  );

  const supabase = createServerClient({ req, res });
  const PAGE_SIZE = 4;

  try {
    // First get total count of public clips
    const { count } = await supabase
      .from('clips')
      .select('id', { count: 'exact', head: true })
      .eq('visibility', 'public');

    // Get latest public clips for SEO and initial render
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
      .limit(PAGE_SIZE);

    if (error) throw error;

    // Get featured clip for meta data
    const featuredClip = latestClips?.[0];
    const timestamp = Date.now();
    const previewImage = featuredClip?.thumbnail_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${featuredClip.thumbnail_path}?t=${timestamp}`
      : 'https://merrouchgaming.com/top.jpg';

    // Generate rich description
    const description = featuredClip
      ? `Watch the latest gaming highlights at Merrouch Gaming! Featured: ${featuredClip.title} - an amazing ${featuredClip.game} clip by ${featuredClip.username}. Join our gaming community and share your best moments.`
      : 'Explore amazing gaming moments from the Merrouch Gaming community. Watch, share, and discover gaming highlights from your favorite games.';

    // Generate structured data for clips list
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": latestClips.map((clip, index) => ({
        "@type": "VideoObject",
        "position": index + 1,
        "name": clip.title,
        "description": `${clip.game} gameplay clip by ${clip.username}`,
        "thumbnailUrl": `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`,
        "uploadDate": clip.uploaded_at,
        "contentUrl": `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`,
        "embedUrl": `https://merrouchgaming.com/clip/${clip.id}`,
        "author": {
          "@type": "Person",
          "name": clip.username,
          "url": `https://merrouchgaming.com/profile/${clip.username}`
        },
        "interactionStatistic": [
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/WatchAction",
            "userInteractionCount": clip.views_count || 0
          },
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/LikeAction",
            "userInteractionCount": clip.likes_count || 0
          }
        ]
      }))
    };

    // Add website structured data
    const websiteStructuredData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Merrouch Gaming",
      "url": "https://merrouchgaming.com",
      "description": "Gaming community and clip sharing platform",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://merrouchgaming.com/discover?search={search_term}",
        "query-input": "required name=search_term"
      }
    };

    return {
      props: {
        initialClips: latestClips || [],
        totalClips: count || 0,
        hasMore: (latestClips?.length || 0) < (count || 0),
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
              }
            ],
            site_name: 'Merrouch Gaming',
          },
          twitter: {
            card: 'summary_large_image',
            site: '@merrouchgaming',
            title: 'Discover Gaming Clips | Merrouch Gaming',
            description,
            image: previewImage,
          },
          structuredData: JSON.stringify([structuredData, websiteStructuredData])
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        initialClips: [],
        totalClips: 0,
        hasMore: false,
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

const Discover = ({ initialClips, metaData, totalClips, hasMore: initialHasMore }) => {
  const [isTransitioning] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const playerRefs = useRef(new Map());
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const loaderRef = useRef(null);
  
  const { 
    clips, 
    loading: clipsLoading, 
    updateClipCount,
    setClips
  } = useClipsFeed(supabase, 4, null, false, initialClips, totalClips); // Changed to 4

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

  // Function to load more clips
  const loadMoreClips = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const from = page * 4; // Changed from 50 to 4
      const to = from + 3; // Changed to load 4 items

      const { data: newClips, error } = await supabase
        .from('clips')
        .select('*')
        .eq('visibility', 'public')
        .order('uploaded_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (newClips?.length) {
        setClips(prevClips => {
          // Filter out duplicates
          const newClipsMap = new Map(newClips.map(clip => [clip.id, clip]));
          const existingClips = prevClips.filter(clip => !newClipsMap.has(clip.id));
          return [...existingClips, ...newClips];
        });
        setPage(p => p + 1);
        setHasMore(newClips.length === 4); // Changed to 4
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more clips:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreClips();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [page, hasMore, isLoadingMore]);

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
      {metaData.structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: metaData.structuredData }}
        />
      )}
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

            {/* Loading indicator */}
            {hasMore && (
              <div 
                ref={loaderRef}
                className={styles.loaderContainer}
              >
                {isLoadingMore ? (
                  <div className={styles.loader}>
                    <div className={styles.spinner} />
                    <p>Loading more clips...</p>
                  </div>
                ) : (
                  <button 
                    onClick={loadMoreClips}
                    className={styles.loadMoreButton}
                  >
                    Load More Clips
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      )}
    </ProtectedPageWrapper>
  );
};

export default Discover;