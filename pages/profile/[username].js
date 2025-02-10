import { useState, useCallback, useEffect, useRef } from 'react';
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
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MdCloudUpload } from 'react-icons/md';

// Remove getStaticPaths and getStaticProps
// Add getServerSideProps
export async function getServerSideProps({ req, res, params }) {
  // Add cache control header
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient({ req, res });
  const { username } = params;

  try {
    // Check session server-side
    const { data: { session } } = await supabase.auth.getSession();

    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .single();

    if (profileError) {
      return {
        notFound: true
      };
    }

    // Get user's clips count and latest clip
    const { data: userClips, count } = await supabase
      .from('clips')
      .select('title, game, thumbnail_path, uploaded_at', { count: 'exact' })
      .eq('username', username)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1);

    const latestClip = userClips?.[0];

    // Generate description based on user data
    const description = `Check out ${profileData.username}'s gaming profile on Merrouch Gaming. ${
      count ? `${count} clips shared. ` : ''
    }${latestClip ? `Latest clip: ${latestClip.title} (${latestClip.game})` : ''
    }Join our gaming community to watch and share your best gaming moments.`;

    // Prepare meta data with rich snippets
    const metaData = {
      title: `${profileData.username}'s Profile | Merrouch Gaming`,
      description,
      image: latestClip?.thumbnail_path 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${latestClip.thumbnail_path}`
        : 'https://merrouchgaming.com/top.jpg',
      url: `https://merrouchgaming.com/profile/${username}`,
      type: 'profile',
      structuredData: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "mainEntity": {
          "@type": "Person",
          "name": profileData.username,
          "url": `https://merrouchgaming.com/profile/${profileData.username}`,
          "description": description,
          "interactionStatistic": [
            {
              "@type": "InteractionCounter",
              "interactionType": "http://schema.org/CreateAction",
              "userInteractionCount": count || 0,
              "name": "Clips Shared"
            }
          ],
          "potentialAction": {
            "@type": "ViewAction",
            "target": `https://merrouchgaming.com/profile/${profileData.username}`
          }
        },
        "about": {
          "@type": "VideoGallery",
          "name": `${profileData.username}'s Gaming Clips`,
          "numberOfItems": count || 0,
          "url": `https://merrouchgaming.com/profile/${profileData.username}`
        }
      }),
      openGraph: {
        title: `${profileData.username}'s Gaming Profile | Merrouch Gaming`,
        description,
        images: [
          {
            url: latestClip?.thumbnail_path 
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${latestClip.thumbnail_path}`
              : 'https://merrouchgaming.com/top.jpg',
            width: 1200,
            height: 630,
            alt: `${profileData.username}'s profile thumbnail`
          }
        ],
        type: 'profile',
        profile: {
          username: profileData.username
        }
      },
      twitter: {
        card: 'summary_large_image',
        site: '@merrouchgaming',
        title: `${profileData.username}'s Gaming Profile | Merrouch Gaming`,
        description,
        image: latestClip?.thumbnail_path 
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${latestClip.thumbnail_path}`
          : 'https://merrouchgaming.com/top.jpg'
      }
    };

    return {
      props: {
        initialSession: session,
        profile: profileData,
        isOwnProfile: session?.user?.email === profileData.email,
        userData: {
          ...profileData,
          clipsCount: count || 0,
          latestClip: latestClip || null
        },
        metaData
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      notFound: true
    };
  }
}

const ProfilePage = ({ userData, metaData, error }) => {
  const previousUsername = useRef(userData.username);
  const router = useRouter();
  const { user, supabase, isLoggedIn } = useAuth();
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
    setClips,
    resetClips,
    fetchClips
  } = useClipsFeed(
    supabase, 
    6, 
    userData.username, 
    isOwner, 
    isLoggedIn
  );

  const isMobile = useMediaQuery('(max-width: 768px)');

  // Define the style objects
  const mainStyles = { 
    padding: isMobile === null ? '20px' : (isMobile ? '10px' : '20px')
  };

  const headerStyles = {
    position: isMobile ? 'sticky' : 'relative',
    top: isMobile ? '0' : 'auto',
    zIndex: isMobile ? '10' : '1',
    background: isMobile ? 'var(--background-color)' : 'transparent'
  };

  const mainClassName = styles.profileMain;

  // Reset everything when username changes
  useEffect(() => {
    if (previousUsername.current === userData.username) return;
    previousUsername.current = userData.username;
    setPlayingVideoId(null);
    setSearchQuery('');
    resetClips();
  }, [userData.username, resetClips]);

  // Add a loading timeout to prevent flash of "no clips" message
  const [showNoClips, setShowNoClips] = useState(false);
  useEffect(() => {
    if (!loading && clips.length === 0) {
      const timer = setTimeout(() => setShowNoClips(true), 1000);
      return () => clearTimeout(timer);
    }
    setShowNoClips(false);
  }, [loading, clips.length]);

  // Add this new effect to watch for auth state changes
  useEffect(() => {
    // When auth state changes (login/logout)
    setPlayingVideoId(null);
    resetClips();
    // Force a refetch with new auth state
    fetchClips && fetchClips();
  }, [isLoggedIn]); // Watch isLoggedIn state

  const handleClipUpdate = useCallback(async (updatedClip) => {
    if (!isOwner) return;

    try {
      const { error } = await supabase
        .from('clips')
        .update({
          visibility: updatedClip.visibility
        })
        .eq('id', updatedClip.id)
        .eq('username', userData.username);

      if (error) {
        throw error;
      }

      setClips(prevClips => 
        prevClips.map(clip => 
          clip.id === updatedClip.id 
            ? { ...clip, visibility: updatedClip.visibility } 
            : clip
        )
      );

      console.log('Clip updated successfully:', updatedClip.visibility);

    } catch (error) {
      console.error('Error updating clip:', error);
      setClips(prevClips => [...prevClips]);
      alert('Failed to update clip visibility');
    }
  }, [isOwner, supabase, userData.username, setClips]); // Add setClips to dependencies

  const handleClipDelete = useCallback(async (clipId) => {
    if (!isOwner) return;

    try {
      // Delete the clip from Supabase
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clipId)
        .eq('username', userData.username);

      if (error) throw error;

      // Update the UI by removing the deleted clip
      setClips(prevClips => prevClips.filter(clip => clip.id !== clipId));
      
      // Update the clip count in the profile
      if (updateClipCount) {
        updateClipCount(clipId, 'total', -1);
      }
    } catch (error) {
      console.error('Error deleting clip:', error);
      alert('Failed to delete clip');
    }
  }, [isOwner, supabase, userData.username, updateClipCount, setClips]);

  const handlePlay = (clipId) => {
    if (playingVideoId !== clipId) {
      setPlayingVideoId(clipId);
    }
  };

  const handlePlayerInit = useCallback((_clipId, _playerInstance) => {
    // Add any player initialization logic here if needed
  }, []);

  const handlePlayerReady = useCallback(() => {
    // Add any player ready logic here if needed
  }, []);

  // Debug logs
  useEffect(() => {
    console.log('Profile page rendered for:', userData.username);
  }, [userData.username]);

  // Debug logs
  useEffect(() => {
    console.log('Clips state:', { loading, clipsCount: clips.length, hasMore });
  }, [loading, clips, hasMore]);

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

  // Move this up, before any return statements
  const UploadButton = ({ isFixed = false }) => (
    <button 
      onClick={() => router.push('/upload')}
      className={`${styles.uploadButton} ${isFixed ? styles.fixedButton : styles.inlineButton}`}
      aria-label="Upload new clip"
    >
      <MdCloudUpload className={styles.uploadIcon} />
      <span>{isFixed ? 'Upload Clip' : 'Upload New Clip'}</span>
    </button>
  );

  // Loading state
  if (loading && clips.length === 0) {
    return (
      <ProtectedPageWrapper>
        <DynamicMeta {...metaData} />
        <main className={mainClassName} style={mainStyles}>
          <div className={styles.profileHeader} style={headerStyles}>
            <UserProfileSection 
              username={userData.username} 
              isOwner={isOwner}
              user={user}
              supabase={supabase}
            />
            {isOwner && (
              <div className={styles.uploadButtonContainer}>
                <UploadButton isFixed={false} />
              </div>
            )}
            <UserSearch 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              username={userData.username}
            />
          </div>
          <div className={styles.clipsGrid}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.clipWrapper}>
                <LoadingClip />
              </div>
            ))}
          </div>
        </main>
        {!isOwner && user && <UploadButton isFixed={true} />}
      </ProtectedPageWrapper>
    );
  }

  // No clips state
  if (!loading && clips.length === 0 && showNoClips) {
    return (
      <ProtectedPageWrapper>
        <main 
          className={mainClassName}
          style={mainStyles}
        >
          <div 
            className={styles.profileHeader}
            style={headerStyles}
          >
            <UserProfileSection 
              username={userData.username} 
              isOwner={isOwner}
              user={user}
              supabase={supabase}
            />
            {isOwner && (
              <div className={styles.uploadButtonContainer}>
                <UploadButton isFixed={false} />
              </div>
            )}
            <UserSearch 
              activeTab={activeTab}
              onTabChange={setActiveTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              username={userData.username}
            />
          </div>
          <div className={styles.noClipsMessage}>
            No clips found for {userData.username}
          </div>
        </main>
        {!isOwner && user && <UploadButton isFixed={true} />}
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main className={mainClassName} style={mainStyles}>
        <div className={styles.profileHeader} style={headerStyles}>
          <UserProfileSection 
            username={userData.username} 
            isOwner={isOwner}
            user={user}
            supabase={supabase}
          />
          {isOwner && (
            <div className={styles.uploadButtonContainer}>
              <UploadButton isFixed={false} />
            </div>
          )}
          <UserSearch 
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            username={userData.username}
          />
        </div>
        <div className={styles.clipsGrid}>
          {Array.isArray(clips) && clips.map(clip => (
            <div key={clip.id} className={styles.clipCard}>
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
                isOwner={isOwner}
                onClipUpdate={handleClipUpdate}
                onClipDelete={() => handleClipDelete(clip.id)}
                playsInline
              />
            </div>
          ))}
          {hasMore && (
            <div ref={loaderRef} className={styles.loaderContainer}>
              {loading && (
                <div className={styles.loader}>
                  <div className={styles.spinner} />
                  <p>Loading more clips...</p>
                </div>
              )}
            </div>
          )}
        </div>
        {!isOwner && user && <UploadButton isFixed={true} />}
      </main>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage; 