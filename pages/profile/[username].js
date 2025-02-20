import { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/Profile.module.css';
import VideoPlayer from '../../components/VideoPlayer';
import { useProfileClips } from '../../hooks/useProfileClips';
import UserProfileSection from '../../components/UserProfileSection';
import LoadingClip from '../../components/LoadingClip';
import UserSearch from '../../components/UserSearch';
import { createClient } from '../../utils/supabase/server-props';
import DynamicMeta from '../../components/DynamicMeta';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MdCloudUpload } from 'react-icons/md';
import ClipCard from '../../components/ClipCard';
import { debounce } from 'lodash';
import { useVirtualizer } from '@tanstack/react-virtual';

// Remove getStaticPaths and getStaticProps
// Add getServerSideProps
export async function getServerSideProps({ req, res, params }) {
  const supabase = createClient({ req, res });
  const { username } = params;
  const normalizedUsername = username.toLowerCase();

  try {
    // Get session data
    const { data, error: sessionError } = await supabase.auth.getSession();
    const session = data?.session;

    // Get profile data
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('username', normalizedUsername)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return { notFound: true };
    }

    // Set cache headers based on authentication status
    if (session?.user?.id === profileData.id) {
      // Owner viewing their profile: no cache
      res.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate'
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Public viewing profile: short cache
      res.setHeader(
        'Cache-Control',
        'public, max-age=10, stale-while-revalidate=59'
      );
    }

    // Get current user's full data if logged in
    let currentUserData = null;
    let isOwner = false;

    if (session?.user?.id) {
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('username, id, email')
        .eq('id', session.user.id)
        .single();

      if (!userDataError) {
        currentUserData = userData;
        isOwner = currentUserData?.username?.toLowerCase() === normalizedUsername;
      }
    }

    // Get total count of public clips for this user
    const { count: totalPublicClips } = await supabase
      .from('clips')
      .select('id', { count: 'exact' })
      .eq('username', normalizedUsername)
      .eq('visibility', 'public');

    // Fetch initial clips with proper thumbnail URLs
    const { data: initialClips, error: clipsError } = await supabase
      .from('clips')
      .select(`
        id,
        title,
        game,
        visibility,
        likes_count,
        views_count,
        uploaded_at,
        username,
        cloudflare_uid,
        user_id,
        file_path,
        thumbnail_path
      `)
      .eq('username', normalizedUsername)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(3);

    if (clipsError) {
      console.error('Clips fetch error:', clipsError);
      return { notFound: true };
    }

    const latestClip = initialClips?.[0];

    // Process clips to ensure proper thumbnail URLs
    const processedClips = initialClips?.map(clip => ({
      ...clip,
      thumbnail_url: clip.cloudflare_uid 
        ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`
        : 'https://merrouchgaming.com/top.jpg'
    }));

    // Get the latest clip's thumbnail for the meta image
    const latestClipThumbnail = processedClips?.[0]?.thumbnail_url || 'https://merrouchgaming.com/top.jpg';

    // Generate description
    const description = `Check out ${profileData.username}'s gaming profile on Merrouch Gaming. ${
      totalPublicClips ? `${totalPublicClips} clips shared. ` : ''
    }${latestClip ? `Latest clip: ${latestClip.title} (${latestClip.game})` : ''
    }Join our gaming community to watch and share your best gaming moments.`;

    // Set cache headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );

    return {
      props: {
        initialSession: session,
        profile: profileData,
        isOwnProfile: isOwner,
        isAuthenticated: !!session,
        userData: {
          ...profileData,
          username: normalizedUsername,
          clipsCount: totalPublicClips || 0,
          initialClips: processedClips || [],
          hasMore: totalPublicClips > 3,
          latestClip: processedClips?.[0] || null
        },
        userClips: processedClips || [],
        metaData: {
          title: `${profileData.username}'s Gaming Profile | Merrouch Gaming`,
          description: `Check out ${profileData.username}'s gaming highlights and clips. ${totalPublicClips} amazing moments captured at Merrouch Gaming Center using RTX 3070 gaming PCs.`,
          image: latestClipThumbnail,
          url: `https://merrouchgaming.com/profile/${username}`,
          type: 'profile',
          openGraph: {
            title: `${profileData.username} - Gaming Profile`,
            description: `Gaming highlights and clips by ${profileData.username}. Join our gaming community!`,
            images: [
              {
                url: latestClipThumbnail,
                width: 1200,
                height: 630,
                alt: `${profileData.username}'s Latest Gaming Clip`
              }
            ]
          },
          structuredData: {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "name": `${profileData.username}'s Gaming Profile`,
            "description": `Gaming profile and highlights of ${profileData.username}`,
            "author": {
              "@type": "Person",
              "name": profileData.username,
              "url": `https://merrouchgaming.com/profile/${username}`
            },
            "interactionStatistic": [
              {
                "@type": "InteractionCounter",
                "interactionType": "http://schema.org/WatchAction",
                "userInteractionCount": initialClips.reduce((total, clip) => total + (clip.views_count || 0), 0)
              }
            ]
          }
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return { 
      props: {
        error: 'Failed to load profile',
        userData: null,
        isAuthenticated: false,
        metaData: {
          title: 'Profile Not Found | Merrouch Gaming',
          description: 'Unable to load profile'
        }
      }
    };
  }
}

// Memoize the clips grid
const ClipsGrid = memo(({ clips, loading, hasMore, ...props }) => {
  const parentRef = useRef();
  const [localClips, setLocalClips] = useState(clips);
  const { supabase } = useAuth();
  
  // Update localClips when clips prop changes
  useEffect(() => {
    setLocalClips(clips);
  }, [clips]);

  // Add real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('profile-clips')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'clips',
          filter: `username=eq.${props.username}`
        },
        (payload) => {
          console.log('Clip change received:', payload);
          
          switch (payload.eventType) {
            case 'INSERT':
              // Add new clip to the beginning of the list
              setLocalClips(prev => [payload.new, ...prev]);
              break;
              
            case 'DELETE':
              // Remove deleted clip
              setLocalClips(prev => prev.filter(clip => clip.id !== payload.old.id));
              break;
              
            case 'UPDATE':
              // Update modified clip
              setLocalClips(prev => 
                prev.map(clip => 
                  clip.id === payload.new.id ? payload.new : clip
                )
              );
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription
    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [supabase, props.username]);

  const rowVirtualizer = useVirtualizer({
    count: localClips.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 5
  });

  // Handle clip deletion
  const handleClipUpdate = useCallback((clipId, action) => {
    if (action === 'delete') {
      setLocalClips(prevClips => prevClips.filter(clip => clip.id !== clipId));
    }
  }, []);

  const [error, setError] = useState(null);

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p>Error loading clips. Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className={styles.clipsGrid}>
      {localClips.map((clip, index) => (
        <div 
          key={`clip-${clip.id}-${index}`}
          className={styles.clipWrapper}
        >
          <ClipCard 
            clip={clip}
            isOwner={props.isOwner}
            onClipUpdate={handleClipUpdate}
          />
        </div>
      ))}

      {loading && (
        <div className={`${styles.loadingOverlay} ${loading ? styles.visible : ''}`}>
          <div className={styles.loadingRow}>
            {[...Array(3)].map((_, i) => (
              <div key={`loading-${i}`} className={styles.clipWrapper}>
                <LoadingClip />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && localClips.length === 0 && (
        <div className={styles.noClipsMessage}>
          {props.isOwner 
            ? "You haven't shared any clips yet"
            : `${props.username} hasn't shared any public clips yet`}
        </div>
      )}
    </div>
  );
});

ClipsGrid.displayName = 'ClipsGrid';

const ProfilePage = ({ userData, metaData, error, isAuthenticated, isOwnProfile }) => {
  const router = useRouter();
  const { user: currentUser, supabase, isLoggedIn } = useAuth();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const normalizedUsername = userData?.username?.toLowerCase();

  const {
    clips: userClips,
    loading: clipsLoading,
    hasMore: hasMoreClips,
    error: clipsError
  } = useProfileClips(
    normalizedUsername, 
    isOwnProfile,
    userData?.initialClips || []
  );

  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearchQuery(value);
    }, 300),
    []
  );

  if (router.isFallback) {
    return <div>Loading...</div>;
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

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main className={styles.profileMain}>
        <div className={styles.profileHeader}>
          <UserProfileSection 
            username={userData.username} 
            isOwner={isOwnProfile}
            clipsCount={userData.clipsCount}
            user={currentUser}
            supabase={supabase}
            isAuthenticated={isAuthenticated}
          />
          {isOwnProfile && isLoggedIn && (
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

        <ClipsGrid 
          clips={userClips}
          loading={clipsLoading}
          hasMore={hasMoreClips}
          isOwner={isOwnProfile}
          username={userData.username}
          isAuthenticated={isAuthenticated}
        />
      </main>
      {isAuthenticated && !isOwnProfile && currentUser && isLoggedIn && (
        <UploadButton isFixed={true} />
      )}
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;