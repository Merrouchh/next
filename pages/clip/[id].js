import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import styles from '../../styles/Clip.module.css';
import LoginModal from '../../components/LoginModal';
import VideoPlayer from '../../components/VideoPlayer';
import { useRouter } from 'next/router';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import { NextSeo } from 'next-seo';

// Add getServerSideProps for initial data fetch
export async function getServerSideProps(context) {
  context.res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const { id } = context.params;
  const supabase = createServerClient(context);
  const SUPABASE_URL = 'https://qdbtccrhcidxllycuxnw.supabase.co';

  try {
    const { data: clip, error } = await supabase
      .from('clips')
      .select(`
        id, username, title, thumbnail_path, file_path, 
        visibility, user_id, game
      `)
      .eq('id', id)
      .single();

    if (error || !clip) {
      return { props: { error: 'Clip not found' } };
    }

    const thumbnailUrl = clip.thumbnail_path 
      ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`
      : 'https://merrouchgaming.com/top.jpg';

    // Force cache refresh with timestamp
    const timestamp = Date.now();
    
    return {
      props: {
        clip: {
          ...clip,
          url: clip.file_path ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}` : null,
          thumbnailUrl
        },
        metaData: {
          title: `${clip.game} Gameplay by ${clip.username} | Merrouch Gaming`,
          description: `${clip.title} - Watch amazing ${clip.game} gaming moments at Cyber Merrouch Gaming Center in Tangier.`,
          image: `${thumbnailUrl}?t=${timestamp}`,
          url: `https://merrouchgaming.com/clip/${clip.id}`,
          type: 'video.other'
        }
      }
    };
  } catch (error) {
    return { props: { error: 'Error loading clip' } };
  }
}

export default function ClipPage({ clip, metaData, error, isPrivate, clipOwner }) {
  const { user, supabase } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const router = useRouter();

  // If the page is not yet generated, this will be displayed
  // initially until getServerSideProps() completes
  if (router.isFallback) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <>
        <NextSeo
          title="Clip Not Found | Merrouch Gaming"
          description="This clip is not available or may be private."
          canonical={`https://merrouchgaming.com/clip/${router.query.id}`}
          openGraph={{
            title: "Clip Not Found | Merrouch Gaming",
            description: "This clip is not available or may be private.",
            url: `https://merrouchgaming.com/clip/${router.query.id}`,
            type: 'website',
          }}
        />
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
      </>
    );
  }

  const handleClipUpdate = (updatedClip) => {
    // ... updateClip function
  };

  return (
    <>
      <NextSeo
        title={metaData.title}
        description={metaData.description}
        canonical={metaData.url}
        openGraph={{
          title: metaData.title,
          description: metaData.description,
          url: metaData.url,
          type: metaData.type,
          images: [
            {
              url: metaData.image,
              width: 1200,
              height: 630,
              alt: metaData.title,
            },
          ],
        }}
        twitter={{
          handle: '@merrouchgaming',
          site: '@merrouchgaming',
          cardType: 'summary_large_image',
        }}
      />
      <ProtectedPageWrapper>
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
    </>
  );
} 