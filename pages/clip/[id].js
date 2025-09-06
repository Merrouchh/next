import { useRouter } from 'next/router';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import { createClient as createBrowserClient } from '../../utils/supabase/component';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import { useEffect, useState } from 'react';
import ClipCard from '../../components/ClipCard';
import styles from '../../styles/ClipPage.module.css';

export async function getServerSideProps({ req, res, params }) {
  const { id } = params;
  const supabase = createServerClient({ req, res });

  try {
    // Get session to check ownership
    const { data: { user } } = await supabase.auth.getUser();

    // Get clip data
    const { data: clip, error } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    // Disable all caching - always fresh data for all clips
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log('Clip data:', clip);

    // Handle different scenarios
    if (error?.code === 'PGRST116') {
      // PGRST116 means no rows returned - clip doesn't exist
      console.log('Clip not found');
      return {
        props: {
          status: 'not_found',
          // Server-side metadata now handled in _document.js
        }
      };
    }

    if (error) {
      // Other database errors
      console.error('Database error:', error);
      return {
        props: {
          status: 'error',
          error: 'Failed to load clip',
          // Server-side metadata now handled in _document.js
        }
      };
    }

    // Check ownership and visibility
    const isOwner = user?.id === clip.user_id;
    const isPrivate = clip.visibility === 'private';

    // Block access to private clips for non-owners
    if (isPrivate && !isOwner) {
      console.log('Private clip, access denied');
      return {
        props: {
          status: 'private',
          isPrivate: true,
          isOwnClip: false,
          // Server-side metadata now handled in _document.js
        }
      };
    }
    
    // If the clip is private but the user is the owner, allow access
    if (isPrivate && isOwner) {
      console.log('Private clip, owner access granted');
    }

    // Generate rich description with stats
    const description = `Watch this amazing gaming moment by ${clip.username} at Merrouch Gaming Center. ${
      clip.views_count ? `${clip.views_count.toLocaleString()} views` : ''
    }${clip.likes_count ? `, ${clip.likes_count.toLocaleString()} likes` : ''
    }. High-quality gaming clips from our RTX 3070 gaming PCs.`;

    // Generate video and thumbnail URLs
    const videoUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`;
    
    // Determine thumbnail URL with priority order
    let thumbnailUrl = 'https://merrouchgaming.com/top.jpg';
    
    if (clip.cloudflare_uid) {
      // Cloudflare Stream thumbnail (highest quality)
      thumbnailUrl = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clip.cloudflare_uid}/thumbnails/thumbnail.jpg`;
    } else if (clip.thumbnail_path) {
      // Fallback to stored thumbnail if available
      thumbnailUrl = clip.thumbnail_path.startsWith('http') 
        ? clip.thumbnail_path 
        : `${process.env.SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`;
    }
    
    console.log('Using thumbnail URL for clip page:', thumbnailUrl);

    return {
      props: {
        clip,
        status: 'success',
        isOwnClip: isOwner,
        isPrivate,
        // Server-side metadata now handled in _document.js
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        status: 'error',
        error: 'An unexpected error occurred',
        // Server-side metadata now handled in _document.js
      }
    };
  }
}

const ClipPage = ({ clip, status, error, isOwnClip, isPrivate }) => {
  const router = useRouter();
  const { isLoggedIn, user, supabase } = useAuth();
  const [localClip, setLocalClip] = useState(clip);
  const [shouldShowClip, setShouldShowClip] = useState(true);

  // Effect to handle real-time updates
  useEffect(() => {
    if (!clip?.id) return;
    
    const channel = supabase
      .channel(`clip-${clip.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips',
          filter: `id=eq.${clip.id}`
        },
        (payload) => {
          console.log('Clip update received:', payload);
          
          switch (payload.eventType) {
            case 'UPDATE':
              // Update clip data
              setLocalClip(payload.new);
              // Handle visibility changes
              if (payload.new.visibility === 'private' && !isLoggedIn && !isOwnClip) {
                console.log('Clip changed to private, hiding for non-owner');
                setShouldShowClip(false);
              } else if (payload.new.visibility === 'private' && isLoggedIn && user?.id !== payload.new.user_id) {
                console.log('Clip changed to private, hiding for non-owner user');
                setShouldShowClip(false);
              }
              break;
              
            case 'DELETE':
              console.log('Clip was deleted');
              // Redirect to discover page with a message
              router.replace({
                pathname: '/discover',
                query: { message: 'The clip has been deleted' }
              });
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Clip subscription status:', status);
      });

    return () => {
      console.log('Cleaning up clip subscription');
      supabase.removeChannel(channel);
    };
  }, [clip?.id, isLoggedIn, supabase, router, user?.id, isOwnClip]);

  // Effect to handle auth state changes
  useEffect(() => {
    if (!isLoggedIn && localClip?.visibility === 'private' && !isOwnClip) {
      setShouldShowClip(false);
    } else if (isLoggedIn && user?.id === localClip?.user_id) {
      // Always show clip to its owner, even if private
      setShouldShowClip(true);
    }
  }, [isLoggedIn, localClip?.visibility, localClip?.user_id, user?.id, isOwnClip]);

  // Fix the condition to properly check if the user is the owner
  // If user is owner, we should show the clip regardless of privacy status
  if (isOwnClip) {
    // Always render the clip for its owner, even if private
    return (
      <ProtectedPageWrapper>
        <main className={styles.main}>
          <div className={styles.clipContainer}>
            <ClipCard
              clip={localClip}
              isFullWidth={true}
              onClipUpdate={(clipId, action) => {
                if (action === 'delete') {
                  router.replace('/discover');
                }
              }}
            />
            {isPrivate && (
              <div className={styles.privateNotice}>
                <p>This clip is private and only visible to you.</p>
              </div>
            )}
          </div>
        </main>
      </ProtectedPageWrapper>
    );
  }
  
  // For non-owners, check visibility rules
  if ((!shouldShowClip || status === 'private') && !isOwnClip) {
    return (
      <ProtectedPageWrapper>
        <main className={styles.errorContainer}>
          <div className={`${styles.errorMessage} ${styles.private}`}>
            <h1>Private Clip</h1>
            <p>This clip is private and can only be viewed by its owner.</p>
            <button 
              onClick={() => router.push('/discover')}
              className={styles.backButton}
            >
              Discover Public Clips
            </button>
          </div>
        </main>
      </ProtectedPageWrapper>
    );
  }

  if (status === 'not_found') {
    return (
      <ProtectedPageWrapper>
        <main className={styles.errorContainer}>
          <div className={`${styles.errorMessage} ${styles.notFound}`}>
            <h1>Clip Not Found</h1>
            <p>This clip may have been deleted or does not exist.</p>
            <button 
              onClick={() => router.push('/discover')}
              className={styles.backButton}
            >
              Discover More Clips
            </button>
          </div>
        </main>
      </ProtectedPageWrapper>
    );
  }

  if (status === 'error') {
    return (
      <ProtectedPageWrapper>
        <main className={styles.errorContainer}>
          <div className={`${styles.errorMessage} ${styles.error}`}>
            <h1>Error</h1>
            <p>{error}</p>
            <button 
              onClick={() => router.push('/discover')}
              className={styles.backButton}
            >
              Back to Discover
            </button>
          </div>
        </main>
      </ProtectedPageWrapper>
    );
  }

  // Normal clip render
  return (
    <ProtectedPageWrapper>
      <main className={styles.main}>
        <div className={styles.clipContainer}>
          <ClipCard
            clip={localClip}
            isFullWidth={true}
            onClipUpdate={(clipId, action) => {
              if (action === 'delete') {
                router.replace('/discover');
              }
            }}
          />
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default ClipPage;