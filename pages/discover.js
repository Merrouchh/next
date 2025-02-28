import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient as createServerClient } from '../utils/supabase/server-props';
import { createClient as createBrowserClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import ClipCard from '../components/ClipCard';
import DynamicMeta from '../components/DynamicMeta';
import styles from '../styles/Discover.module.css';
import { VideoProvider } from '../contexts/VideoContext';

const CLIPS_PER_PAGE = 5;

export async function getServerSideProps({ req, res }) {
  // Set cache headers for discover page
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );
  res.setHeader(
    'Surrogate-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );

  const supabase = createServerClient({ req, res });
  
  try {
    // Get total count of public clips
    const { count } = await supabase
      .from('clips')
      .select('id', { count: 'exact' })
      .eq('visibility', 'public');

    // Fetch initial clips
    const { data: clips, error } = await supabase
      .from('clips')
      .select(`
        id, 
        thumbnail_path, 
        title, 
        username,
        game, 
        visibility, 
        likes_count, 
        views_count,
        file_path,
        uploaded_at,
        user_id,
        cloudflare_uid
      `)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(CLIPS_PER_PAGE);

    if (error) throw error;

    // Process clips to ensure proper thumbnail URLs
    const processedClips = clips?.map(clip => ({
      ...clip,
      thumbnail_url: clip.cloudflare_uid 
        ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`
        : 'https://merrouchgaming.com/top.jpg'
    }));

    const featuredClip = processedClips?.[0];
    const previewImage = featuredClip?.thumbnail_url || 'https://merrouchgaming.com/top.jpg';

    // Set cache headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=120'
    );

    return {
      props: {
        initialClips: processedClips || [],
        totalClips: count || 0,
        hasMore: (clips?.length || 0) < (count || 0),
        metaData: {
          title: "Discover Gaming Highlights | RTX 3070 Gaming Clips",
          description: "Watch the best gaming moments from our community. High-quality gaming clips recorded on RTX 3070 PCs at Merrouch Gaming Center in Tangier.",
          image: previewImage,
          url: "https://merrouchgaming.com/discover",
          type: "website",
          openGraph: {
            title: "Gaming Highlights & Clips | Merrouch Gaming",
            description: "Discover amazing gaming moments from our RTX 3070 gaming setups. Watch, share, and create your own highlights!",
            images: [
              {
                url: "https://merrouchgaming.com/discover-preview.jpg",
                width: 1200,
                height: 630,
                alt: "Gaming Highlights"
              }
            ]
          },
          structuredData: {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Gaming Highlights & Clips",
            "description": "Collection of gaming highlights from Merrouch Gaming Center",
            "provider": {
              "@type": "Organization",
              "name": "Merrouch Gaming",
              "url": "https://merrouchgaming.com"
            },
            "about": {
              "@type": "Thing",
              "name": "Gaming Highlights",
              "description": "High-quality gaming clips recorded on RTX 3070 PCs"
            }
          }
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

const Discover = ({ initialClips, totalClips, hasMore: initialHasMore, metaData }) => {
  const { supabase } = useAuth();
  const [clips, setClips] = useState(initialClips);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadMoreClips = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const start = clips.length;
      const end = start + (CLIPS_PER_PAGE - 1);

      const { data: newClips, error } = await supabase
        .from('clips')
        .select(`
          id, 
          thumbnail_path, 
          title, 
          username,
          game, 
          visibility, 
          likes_count, 
          views_count,
          file_path,
          uploaded_at,
          user_id,
          cloudflare_uid
        `)
        .eq('visibility', 'public')
        .order('uploaded_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      if (newClips?.length) {
        setClips(prev => [...prev, ...newClips]);
        const newHasMore = clips.length + newClips.length < totalClips;
        setHasMore(newHasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more clips:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle scroll with throttling
  useEffect(() => {
    let timeoutId = null;

    const handleScroll = () => {
      if (timeoutId || isLoading || !hasMore) return;

      timeoutId = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Calculate percentage scrolled
        const scrollPercentage = (scrollTop + windowHeight) / documentHeight * 100;
        
        // Load more when user has scrolled past 95% of the page
        if (scrollPercentage > 95) {
          console.log(`Scrolled ${scrollPercentage.toFixed(2)}% - Loading more`);
          loadMoreClips();
        }

        timeoutId = null;
      }, 150); // Throttle scroll events
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasMore, isLoading]);

  // Subscribe to changes in clips
  useEffect(() => {
    console.log('Setting up realtime subscription');

    const subscription = supabase
      .channel('public_clips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips'
        },
        (payload) => {
          console.log('Received realtime event:', payload.eventType, payload);

          switch (payload.eventType) {
            case 'INSERT':
              if (payload.new.visibility === 'public' && payload.new.cloudflare_uid) {
                console.log('Adding new public clip:', payload.new.id);
                setClips(prevClips => {
                  if (prevClips.some(clip => clip.id === payload.new.id)) {
                    return prevClips;
                  }
                  return [payload.new, ...prevClips];
                });
              }
              break;

            case 'UPDATE':
              console.log('Updating clip:', payload.new.id, 'Visibility:', payload.new.visibility);
              setClips(prevClips => {
                return prevClips.map(clip => {
                  if (clip.id !== payload.new.id) return clip;
                  
                  // If clip was made private, remove it
                  if (payload.new.visibility === 'private') {
                    return null;
                  }
                  // Otherwise update it
                  return { ...clip, ...payload.new };
                }).filter(Boolean); // Remove null entries (private clips)
              });
              break;

            case 'DELETE':
              console.log('Removing deleted clip:', payload.old.id);
              setClips(prevClips => 
                prevClips.filter(clip => clip.id !== payload.old.id)
              );
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(subscription);
    };
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <VideoProvider>
        <main className={styles.discoverMain}>
          <div className={styles.feedContainer}>
            {clips.length > 0 ? (
              <>
                {clips.map(clip => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                  />
                ))}
                <div className={styles.loadingMore}>
                  {isLoading && (
                    <div className={styles.spinner} />
                  )}
                  {!hasMore && (
                    <div className={styles.endMessage}>
                      <span className={styles.endIcon}>🎮</span>
                      <p>You've seen all the clips!</p>
                      <p className={styles.endSubtext}>Check back later for more gaming moments</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.noClips}>
                No clips available at the moment
              </div>
            )}
          </div>
        </main>
      </VideoProvider>
    </ProtectedPageWrapper>
  );
};

export default Discover;