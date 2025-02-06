import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import styles from '../../styles/Clip.module.css';
import LoginModal from '../../components/LoginModal';
import VideoPlayer from '../../components/VideoPlayer';
import { useRouter } from 'next/router';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import DynamicMeta from '../../components/DynamicMeta';

// Add getServerSideProps for initial data fetch
export async function getServerSideProps(context) {
  const { id } = context.params;
  const supabase = createServerClient(context);
  const SUPABASE_URL = 'https://qdbtccrhcidxllycuxnw.supabase.co';

  try {
    // Get the clip data
    const { data: clip, error } = await supabase
      .from('clips')
      .select(`
        id,
        username,
        title,
        thumbnail_path,
        file_path,
        visibility,
        user_id,
        game
      `)
      .eq('id', id)
      .single();

    if (error || !clip) {
      return { props: { error: 'Clip not found' } };
    }

    // Check if the clip is private
    const { data: { user } } = await supabase.auth.getUser();
    if (clip.visibility === 'private' && (!user || user.id !== clip.user_id)) {
      return { 
        props: { 
          error: 'This clip is private',
          isPrivate: true,
          clipOwner: clip.username 
        } 
      };
    }

    // Prepare meta data
    const thumbnailUrl = clip.thumbnail_path 
      ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`
      : 'https://merrouchgaming.com/top.jpg';

    const metaData = {
      title: `${clip.game} Gameplay by ${clip.username} | Merrouch Gaming`,
      description: `${clip.title} - Watch amazing ${clip.game} gaming moments at Cyber Merrouch Gaming Center in Tangier.`,
      image: thumbnailUrl,
      url: `https://merrouchgaming.com/clip/${clip.id}`,
      type: 'video.other'
    };

    return {
      props: {
        clip: {
          ...clip,
          url: clip.file_path ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}` : null,
          thumbnailUrl
        },
        metaData
      }
    };
  } catch (error) {
    console.error('Error fetching clip:', error);
    return { props: { error: 'Error loading clip' } };
  }
}

export default function ClipPage({ clip, metaData, error, isPrivate, clipOwner }) {
  const { user, supabase } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const router = useRouter();

  // Move useEffect before any conditionals
  useEffect(() => {
    let mounted = true;
    
    const updateClip = async () => {
      if (!mounted) return;
      // ... async operations
    };

    if (error) {
      // Handle error case
      return;
    }

    updateClip();

    return () => {
      mounted = false;
    };
  }, [error]);

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.errorContainer}>
          <h1>{isPrivate ? 'Private Clip' : 'Error'}</h1>
          {isPrivate ? (
            <>
              <p>This clip by {clipOwner} is private.</p>
              {!user ? (
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className={styles.loginButton}
                >
                  Sign in to view
                </button>
              ) : (
                <p className={styles.errorMessage}>You don't have permission to view this clip.</p>
              )}
            </>
          ) : (
            <p>{error}</p>
          )}
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

  const handleClipUpdate = (updatedClip) => {
    // ... updateClip function
  };

  return (
    <ProtectedPageWrapper>
      {!error && <DynamicMeta {...metaData} />}
      <div className={styles.clipPageWrapper}>
        <div className={styles.clipPageContainer}>
          <div className={styles.clipCard}>
            <VideoPlayer
              clip={clip}
              user={user}
              supabase={supabase}
              isOwner={user?.id === clip.user_id}
              onClipUpdate={handleClipUpdate}
              playing={false}
              light={true}
              showActions={true}
              showHeader={true}
              onViewCountUpdate={(_, newCount) => {
                // ... updateViewCount function
              }}
              onLikeUpdate={(_, newCount) => {
                // ... updateLikeCount function
              }}
            />

            {!user && (
              <div className={styles.signInPrompt}>
                <p>Sign in to like and comment on clips</p>
                <button onClick={() => setIsLoginModalOpen(true)}>
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>

        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
        />
      </div>
    </ProtectedPageWrapper>
  );
} 