import { useState, useCallback } from 'react';
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

const ProfilePage = ({ 
  userData, 
  metaData, 
  error, 
  _initialSession,  // Prefix with underscore
  _profile,         // Prefix with underscore
  _isOwnProfile    // Prefix with underscore
}) => {
  const router = useRouter();
  const { user, supabase } = useAuth();
  const [activeTab, setActiveTab] = useState('clips');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  
  const isOwner = user?.username?.toLowerCase() === userData?.username?.toLowerCase();
  
  const { 
    clips, 
    loading, 
    hasMore, 
    loaderRef, 
    updateClipCount,
    setClips
  } = useClipsFeed(supabase, 6, userData.username, isOwner);

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

  const handlePlayerInit = useCallback((clipId, playerInstance) => {
    // Add any player initialization logic here if needed
  }, []);

  const handlePlayerReady = useCallback(() => {
    // Add any player ready logic here if needed
  }, []);

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
        <UserProfileSection 
          username={userData.username} 
          isOwner={isOwner}
          user={user}
          supabase={supabase}
        />
        <UserSearch 
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          username={userData.username}
        />
        <div className={styles.clipsGrid}>
          {clips.map(clip => (
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
              {isLoadingMore ? (
                <div className={styles.loader}>
                  <div className={styles.spinner} />
                  <p>Loading more clips...</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage; 