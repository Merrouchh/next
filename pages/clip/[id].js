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

  try {
    // First, get the clip data
    const { data: clip, error } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !clip) {
      return { props: { error: 'Clip not found' } };
    }

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();

    // Check if the clip is private and if the user has access
    if (clip.visibility === 'private' && (!user || user.id !== clip.user_id)) {
      return { 
        props: { 
          error: 'This clip is private',
          isPrivate: true,
          clipOwner: clip.username 
        } 
      };
    }

    // Get video URL
    let videoUrl = null;
    if (clip.file_path) {
      const { data: videoData } = await supabase.storage
        .from('highlight-clips')
        .createSignedUrl(clip.file_path, 3600);
      
      videoUrl = videoData?.signedUrl;
    }
    
    // Get thumbnail URL
    let thumbnailUrl = null;
    if (clip.thumbnail_path) {
      const { data: thumbnailData } = await supabase.storage
        .from('highlight-clips')
        .createSignedUrl(clip.thumbnail_path, 3600);
      
      thumbnailUrl = thumbnailData?.signedUrl;
    }

    return {
      props: {
        clip: {
          ...clip,
          url: videoUrl,
          thumbnailUrl: thumbnailUrl || videoUrl
        }
      }
    };
  } catch (error) {
    console.error('Error fetching clip:', error);
    return { props: { error: 'Error loading clip' } };
  }
}

export default function ClipPage({ clip: initialClip, error, isPrivate, clipOwner }) {
  const { user, supabase } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [clip, setClip] = useState(initialClip);
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
    setClip(updatedClip);
  };

  return (
    <ProtectedPageWrapper>
      <DynamicMeta
        title={`Gaming Clip by ${clip.user_name || 'Gamer'} | Merrouch Gaming`}
        description={`Watch this amazing gaming moment captured at Cyber Merrouch Gaming Center. ${clip.description || 'High-end gaming experience in Tangier.'}`}
        image={`https://qdbtccrhcidxllycuxnw.supabase.co/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}?t=${Date.now()}`}
        url={`https://merrouchgaming.com/clip/${clip.id}`}
        type="video.other"
      />
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
                setClip(prev => ({ ...prev, views_count: newCount }));
              }}
              onLikeUpdate={(_, newCount) => {
                setClip(prev => ({ ...prev, likes_count: newCount }));
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