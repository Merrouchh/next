import { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import styles from '../styles/Discover.module.css';
import { MdArrowBack } from 'react-icons/md';
import { createClient } from '../utils/supabase/component';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import VideoPlayer from '../components/VideoPlayer';
import { useClipsFeed } from '../hooks/useClipsFeed';
import LoadingClip from '../components/LoadingClip';
import DynamicMeta from '../components/DynamicMeta';
import { createClient as createServerClient } from '../utils/supabase/server-props';
import Head from 'next/head';

export async function getServerSideProps(context) {
  context.res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient(context);
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    // Get latest clips for initial render and meta preview
    const { data: latestClips, error } = await supabase
      .from('clips')
      .select('id, thumbnail_path, title, username, game, user_id, visibility, likes_count, views_count')
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    // Get a featured clip for the preview image
    const featuredClip = latestClips?.[0];
    
    // Ensure the timestamp is added to prevent caching
    const timestamp = Date.now();
    const previewImage = featuredClip?.thumbnail_path
      ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${featuredClip.thumbnail_path}?t=${timestamp}`
      : 'https://merrouchgaming.com/top.jpg';

    // Create a more detailed description
    const description = featuredClip
      ? `Watch the latest gaming highlights at Merrouch Gaming! Featured: ${featuredClip.title} - an amazing ${featuredClip.game} clip by ${featuredClip.username}. Join our gaming community and share your best moments.`
      : 'Explore amazing gaming moments from the Merrouch Gaming community. Watch, share, and discover gaming highlights from your favorite games.';

    return {
      props: {
        initialClips: latestClips || [],
        metaData: {
          title: 'Discover Gaming Clips | Merrouch Gaming',
          description,
          image: previewImage,
          url: 'https://merrouchgaming.com/discover',
          type: 'website',
          // Add additional OpenGraph metadata
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
          // Add Twitter card metadata
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

const Discover = ({ initialClips, metaData, error }) => {
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
  } = useClipsFeed(supabase, 12, null, false, initialClips);

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

  const handleNavigateToProfile = useCallback(() => {
    setIsTransitioning(true);
    router.push(`/profile/${user.username}`).finally(() => setIsTransitioning(false));
  }, [router, user?.username]);

  if (authLoading || (loading && clips.length === 0) || isTransitioning) {
    return (
      <ProtectedPageWrapper>
        <Head>
          <title>{metaData.title}</title>
          <meta name="description" content={metaData.description} />
          
          {/* OpenGraph tags */}
          <meta property="og:title" content={metaData.title} />
          <meta property="og:description" content={metaData.description} />
          <meta property="og:image" content={metaData.image} />
          <meta property="og:url" content={metaData.url} />
          <meta property="og:type" content={metaData.type} />
          <meta property="og:site_name" content="Merrouch Gaming" />
          
          {/* Twitter tags */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@merrouchgaming" />
          <meta name="twitter:title" content={metaData.title} />
          <meta name="twitter:description" content={metaData.description} />
          <meta name="twitter:image" content={metaData.image} />
          
          <link rel="canonical" href={metaData.url} />
        </Head>
        <DynamicMeta {...metaData} />
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
      <Head>
        <title>{metaData.title}</title>
        <meta name="description" content={metaData.description} />
        
        {/* OpenGraph tags */}
        <meta property="og:title" content={metaData.title} />
        <meta property="og:description" content={metaData.description} />
        <meta property="og:image" content={metaData.image} />
        <meta property="og:url" content={metaData.url} />
        <meta property="og:type" content={metaData.type} />
        <meta property="og:site_name" content="Merrouch Gaming" />
        
        {/* Twitter tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@merrouchgaming" />
        <meta name="twitter:title" content={metaData.title} />
        <meta name="twitter:description" content={metaData.description} />
        <meta name="twitter:image" content={metaData.image} />
        
        <link rel="canonical" href={metaData.url} />
      </Head>
      <DynamicMeta {...metaData} />
      <main className={styles.discoverMain}>
        <div className={styles.feedContainer}>
          {user && (
            <div className={styles.navigationButtons}>
              <button
                onClick={handleNavigateToProfile}
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