import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient as createServerClient } from '../utils/supabase/server-props';
import { createClient as createBrowserClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import ClipCard from '../components/ClipCard';
import DynamicMeta from '../components/DynamicMeta';
import styles from '../styles/Discover.module.css';
import { fetchClips } from '../utils/api';
import { useRouter } from 'next/router';

const CLIPS_PER_PAGE = 5;

// LoadingSpinner component
const LoadingSpinner = ({ message = "Loading clips..." }) => (
  <div className={styles.loadingContainer}>
    <div className={styles.spinner}>
      <div className={styles.spinnerInner}></div>
    </div>
    <p className={styles.loadingText}>{message}</p>
  </div>
);

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

    // Fetch the most recent public clip for preview image
    const { data: latestClip } = await supabase
      .from('clips')
      .select('thumbnail_path, cloudflare_uid')
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    // Get the thumbnail URL from the latest clip or use default
    const previewImage = latestClip?.cloudflare_uid 
      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${latestClip.cloudflare_uid}/thumbnails/thumbnail.jpg`
      : latestClip?.thumbnail_path || 'https://merrouchgaming.com/top.jpg';

    // Set cache headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=120'
    );

    // Build rich metadata
    const metaDescription = "Watch the best gaming moments from our community. High-quality gaming clips recorded on RTX 3070 PCs at Merrouch Gaming Center in Tangier.";

    return {
      props: {
        initialClips: [], // Don't fetch clips initially
        totalClips: count || 0,
        hasMore: (count || 0) > 0, // If there are clips, hasMore is true
        metaData: {
          title: "Discover Gaming Highlights | RTX 3070 Gaming Clips",
          description: metaDescription,
          image: previewImage,
          url: "https://merrouchgaming.com/discover",
          type: "website",
          openGraph: {
            title: "Gaming Highlights & Clips | Merrouch Gaming",
            description: "Discover amazing gaming moments from our RTX 3070 gaming setups. Watch, share, and create your own highlights!",
            images: [
              {
                url: previewImage,
                width: 1200,
                height: 630,
                alt: "Gaming Highlights"
              }
            ]
          },
          twitter: {
            card: "summary_large_image",
            site: "@merrouchgaming",
            title: "Gaming Highlights | Merrouch Gaming",
            description: metaDescription,
            image: previewImage
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
            },
            "image": previewImage
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
  const [initialLoad, setInitialLoad] = useState(true);
  const loaderRef = useRef(null);

  // Load initial clips when component mounts
  useEffect(() => {
    const loadInitialClips = async () => {
      if (!mounted || clips.length > 0) return;
      
      setIsLoading(true);
      
      try {
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
            cloudflare_uid,
            mp4link,
            status
          `)
          .eq('visibility', 'public')
          .order('uploaded_at', { ascending: false })
          .range(0, CLIPS_PER_PAGE - 1);

        if (error) throw error;
        
        if (newClips?.length) {
          // Process clips to add thumbnail_url
          newClips.forEach(clip => {
            clip.thumbnail_url = clip.cloudflare_uid 
              ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`
              : clip.thumbnail_path || 'https://merrouchgaming.com/top.jpg';
          });
          
          setClips(newClips);
          setHasMore(newClips.length < totalClips);
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error loading initial clips:', error);
      } finally {
        setIsLoading(false);
        setInitialLoad(false);
      }
    };
    
    loadInitialClips();
  }, [mounted, supabase, clips.length, totalClips]);

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
          cloudflare_uid,
          mp4link,
          status
        `)
        .eq('visibility', 'public')
        .order('uploaded_at', { ascending: false })
        .range(start, end);

      if (error) throw error;

      if (newClips?.length) {
        // Process clips to add thumbnail_url
        newClips.forEach(clip => {
          clip.thumbnail_url = clip.cloudflare_uid 
            ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`
            : clip.thumbnail_path || 'https://merrouchgaming.com/top.jpg';
        });
        
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

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!mounted || !loaderRef.current) return;
    
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    };
    
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading && !initialLoad) {
        loadMoreClips();
      }
    }, options);
    
    observer.observe(loaderRef.current);
    
    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [mounted, hasMore, isLoading, initialLoad, clips.length]);

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
              if (payload.new.visibility === 'public') {
                console.log('Adding new public clip:', payload.new.id);
                // Ensure we have all required fields including mp4link and processing fields
                const newClip = {
                  ...payload.new,
                  // Add thumbnail_url for client-side use
                  thumbnail_url: payload.new.cloudflare_uid 
                    ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${payload.new.cloudflare_uid}/thumbnails/thumbnail.jpg`
                    : payload.new.thumbnail_path || 'https://merrouchgaming.com/top.jpg',
                  // Ensure status and processing_details are present
                  status: payload.new.status || 'complete',
                  processing_details: payload.new.processing_details || {}
                };
                setClips(prevClips => {
                  if (prevClips.some(clip => clip.id === newClip.id)) {
                    return prevClips;
                  }
                  return [newClip, ...prevClips];
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
                  
                  // For processing updates, ensure we maintain the required fields
                  // and add thumbnail_url if it doesn't exist
                  const updatedClip = { 
                    ...clip, 
                    ...payload.new,
                    // Preserve existing thumbnail_url or generate it
                    thumbnail_url: clip.thumbnail_url || (payload.new.cloudflare_uid 
                      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${payload.new.cloudflare_uid}/thumbnails/thumbnail.jpg`
                      : payload.new.thumbnail_path || 'https://merrouchgaming.com/top.jpg')
                  };
                  
                  return updatedClip;
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
        <LoadingSpinner message="Loading discover page..." />
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main className={styles.discoverMain}>
        <header className={styles.discoverHeader}>
          <h1 className={styles.discoverTitle}>Gaming Highlights</h1>
          <p className={styles.discoverSubtitle}>Discover amazing gaming moments from our community</p>
        </header>
        
        <section className={styles.clipsSection}>
          <h2 className={styles.sectionTitle}>Latest Clips</h2>
          <div className={styles.feedContainer}>
            {initialLoad ? (
              <LoadingSpinner message="Loading clips..." />
            ) : clips.length > 0 ? (
              <>
                {clips.map(clip => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                  />
                ))}
                
                {/* Loading more indicator / End message */}
                <div className={styles.loadingMore} ref={loaderRef}>
                  {isLoading ? (
                    <LoadingSpinner message="Loading more clips..." />
                  ) : !hasMore ? (
                    <div className={styles.endMessage}>
                      <span className={styles.endIcon}>🎮</span>
                      <p>You've seen all the clips!</p>
                      <p className={styles.endSubtext}>Check back later for more gaming moments</p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.noClips}>
                No clips available at the moment
              </div>
            )}
          </div>
        </section>
      </main>
    </ProtectedPageWrapper>
  );
};

export default Discover;