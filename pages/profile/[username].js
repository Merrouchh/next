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
  const { username } = context.params;
  const supabase = createServerClient(context);
  const SUPABASE_URL = 'https://qdbtccrhcidxllycuxnw.supabase.co';

  try {
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (userError || !userData) {
      return {
        props: {
          username,
          userExists: false
        }
      };
    }

    // Get user's latest public clip
    const { data: latestClip } = await supabase
      .from('clips')
      .select('thumbnail_path, title')
      .eq('username', username)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1);

    // Prepare meta data
    const thumbnailUrl = latestClip?.[0]?.thumbnail_path
      ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${latestClip[0].thumbnail_path}`
      : 'https://merrouchgaming.com/top.jpg';

    const metaData = {
      title: `${userData.username}'s Gaming Profile | Merrouch Gaming`,
      description: latestClip?.[0]?.title 
        ? `Latest highlight: ${latestClip[0].title}. Check out more gaming highlights at Cyber Merrouch Gaming Center in Tangier.`
        : `Check out ${userData.username}'s gaming highlights at Cyber Merrouch Gaming Center in Tangier.`,
      image: thumbnailUrl,
      url: `https://merrouchgaming.com/profile/${userData.username}`,
      type: 'profile'
    };

    return {
      props: {
        username,
        userExists: true,
        initialUserData: userData,
        metaData
      }
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return {
      props: {
        username,
        userExists: false,
        error: 'Failed to load user data'
      }
    };
  }
}

const ProfilePage = ({ username, userExists: initialUserExists, error: serverError, metaData }) => {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [userExists, setUserExists] = useState(initialUserExists);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('clips');
  
  const isOwner = user?.username?.toLowerCase() === username?.toLowerCase();
  
  const { 
    clips, 
    loading, 
    hasMore, 
    loaderRef, 
    updateClipCount,
    searchClips,
    setClips
  } = useClipsFeed(supabase, 6, username, isOwner);

  // Add function to check if user exists
  useEffect(() => {
    let mounted = true;

    const checkUserExists = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('username', username)
          .single();

        if (!mounted) return;

        if (error || !data) {
          setUserExists(false);
          return false;
        }
        
        setUserExists(true);
        return true;
      } catch (error) {
        if (!mounted) return;
        console.error('Error checking user:', error);
        setUserExists(false);
        return false;
      }
    };

    if (username) {
      checkUserExists();
    }

    return () => {
      mounted = false;
    };
  }, [username]);

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

  if (serverError) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.errorContainer}>
          <h1>Error</h1>
          <p>{serverError}</p>
          <button onClick={() => router.push('/')}>Back to Home</button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (!userExists) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.userNotFound}>
          <h1>User Not Found</h1>
          <p>The user "{username}" does not exist.</p>
          <button 
            onClick={() => router.push('/')}
            className={styles.backButton}
          >
            Back to Home Page
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
            username={username} 
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
          onSearch={(query) => {
            if (searchClips) {
              searchClips(query);
            }
          }}
        />

        <UserProfileSection 
          username={username} 
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