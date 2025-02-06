import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/Profile.module.css';
import VideoPlayer from '../../components/VideoPlayer';
import { useClipsFeed } from '../../hooks/useClipsFeed';
import UserProfileSection from '../../components/UserProfileSection';
import LoadingClip from '../../components/LoadingClip';
import UserSearch from '../../components/UserSearch';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import DynamicMeta from '../../components/DynamicMeta';

// Remove getStaticPaths and getStaticProps
// Add getServerSideProps
export async function getServerSideProps(context) {
  // Add cache control header
  context.res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const { username } = context.params;
  const supabase = createServerClient(context);
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    // Get user data from users table
    const { data: user, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (error || !user) {
      return {
        props: {
          error: 'Profile not found',
          metaData: {
            title: 'Profile Not Found | Merrouch Gaming',
            description: 'This profile does not exist or has been removed.',
            url: `https://merrouchgaming.com/profile/${username}`,
            type: 'profile',
            image: 'https://merrouchgaming.com/top.jpg'
          }
        }
      };
    }

    // Get user's clips count and latest public clip in one query
    const [{ count }, { data: latestClips }] = await Promise.all([
      supabase
        .from('clips')
        .select('id', { count: 'exact', head: true })
        .eq('username', username)
        .eq('visibility', 'public'),
      supabase
        .from('clips')
        .select('thumbnail_path, title')
        .eq('username', username)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(1)
    ]);

    // Prepare the preview image URL with timestamp to prevent caching
    const timestamp = Date.now();
    const previewImage = latestClips?.[0]?.thumbnail_path
      ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${latestClips[0].thumbnail_path}?t=${timestamp}`
      : 'https://merrouchgaming.com/top.jpg';

    return {
      props: {
        userData: {
          ...user,
          clipsCount: count || 0
        },
        metaData: {
          title: `${user.username}'s Profile | Merrouch Gaming`,
          description: `Check out ${user.username}'s gaming clips at Merrouch Gaming. ${count || 0} clips shared.${
            latestClips?.[0]?.title ? ` Latest: ${latestClips[0].title}` : ''
          }`,
          image: previewImage,
          url: `https://merrouchgaming.com/profile/${username}`,
          type: 'profile'
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        error: 'Error loading profile',
        metaData: {
          title: 'Error | Merrouch Gaming',
          description: 'There was an error loading this profile.',
          url: `https://merrouchgaming.com/profile/${username}`,
          type: 'website',
          image: 'https://merrouchgaming.com/top.jpg'
        }
      }
    };
  }
}

const ProfilePage = ({ userData, metaData, error }) => {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [activeTab, setActiveTab] = useState('clips');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVideoId, setPlayingVideoId] = useState(null);
  
  const isOwner = user?.username?.toLowerCase() === userData?.username?.toLowerCase();
  
  const { 
    clips, 
    loading, 
    hasMore, 
    loaderRef, 
    updateClipCount,
    searchClips,
    setClips
  } = useClipsFeed(supabase, 6, userData.username, isOwner);

  const handleClipUpdate = (updatedClip) => {
    setClips(prevClips => 
      prevClips.map(clip => 
        clip.id === updatedClip.id ? updatedClip : clip
      )
    );
  };

  const handleClipDelete = (clipId) => {
    setClips(prevClips => prevClips.filter(clip => clip.id !== clipId));
  };

  const handlePlay = (clipId) => {
    if (playingVideoId !== clipId) {
      setPlayingVideoId(clipId);
    }
  };

  // Handle the fallback state
  if (router.isFallback) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.errorContainer}>
          <h1>Error</h1>
          <p>{error}</p>
          <button 
            onClick={() => router.push('/discover')}
            className={styles.backButton}
          >
            Back to Discover
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <Head>
          <title>Loading Profile - Merrouch Gaming</title>
        </Head>
        <main className={styles.profileMain}>
          <UserProfileSection 
            username={userData.username} 
            isOwner={isOwner}
            user={user}
            supabase={supabase}
          />
          <div className={styles.clipsGrid}>
            {[...Array(6)].map((_, i) => (
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
      <DynamicMeta {...metaData} />
      <main className={styles.profileMain}>
        <UserSearch 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          username={userData.username}
        />

        <UserProfileSection 
          username={userData.username} 
          isOwner={isOwner}
          user={user}
          supabase={supabase}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className={styles.clipsGrid}>
          {clips.length === 0 ? (
            <div className={styles.noClips}>
              <p>{searchQuery ? 'No clips found matching your search' : 'No clips available'}</p>
            </div>
          ) : (
            <>
              {clips.map((clip) => clip && (
                <div key={clip.id} className={styles.clipWrapper}>
                  <VideoPlayer
                    clip={clip}
                    user={user}
                    supabase={supabase}
                    light={true}
                    playing={playingVideoId === clip.id}
                    onPlay={() => handlePlay(clip.id)}
                    onViewCountUpdate={(clipId, newCount) => 
                      updateClipCount(clipId, 'views_count', newCount)
                    }
                    onLikeUpdate={(clipId, newCount) => 
                      updateClipCount(clipId, 'likes_count', newCount)
                    }
                    isOwner={isOwner}
                    onClipUpdate={handleClipUpdate}
                    onClipDelete={handleClipDelete}
                  />
                </div>
              ))}
              
              {hasMore && (
                <div ref={loaderRef} className={styles.loader}>
                  <div className={styles.spinner} />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage; 