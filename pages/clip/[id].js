import { useRouter } from 'next/router';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import { createClient } from '../../utils/supabase/component';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import VideoPlayer from '../../components/VideoPlayer';
import DynamicMeta from '../../components/DynamicMeta';
import { useEffect } from 'react';

export async function getServerSideProps({ req, res, params }) {
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient({ req, res });
  const { id } = params;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Get clip data without users relation since we don't have avatars yet
    const { data: clip, error } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !clip) {
      return { notFound: true };
    }

    const isOwner = session?.user?.email === clip.email;
    const isPrivate = clip.visibility === 'private';

    // Don't show private clips to non-owners
    if (isPrivate && !isOwner) {
      return {
        props: {
          isPrivate: true,
          isOwnClip: false,
          metaData: {
            title: 'Private Clip | Merrouch Gaming',
            description: 'This content is private',
            type: 'video.other',
            image: 'https://merrouchgaming.com/top.jpg'
          }
        }
      };
    }

    // Prepare video URL and thumbnail
    const videoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}`;
    const thumbnailUrl = clip.thumbnail_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`
      : 'https://merrouchgaming.com/top.jpg';

    // Generate rich description
    const description = `Watch this amazing ${clip.game} gameplay clip by ${clip.username}. ${
      clip.description || ''
    } Shared on Merrouch Gaming with ${clip.views_count || 0} views and ${
      clip.likes_count || 0
    } likes.`;

    // Prepare meta data with rich snippets
    const metaData = {
      title: `${clip.title} by ${clip.username} | Merrouch Gaming`,
      description,
      image: thumbnailUrl,
      url: `https://merrouchgaming.com/clip/${id}`,
      type: 'video.other',
      structuredData: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": clip.title,
        "description": description,
        "thumbnailUrl": thumbnailUrl,
        "uploadDate": clip.uploaded_at,
        "contentUrl": videoUrl,
        "embedUrl": `https://merrouchgaming.com/clip/${clip.id}`,
        "interactionStatistic": [
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/WatchAction",
            "userInteractionCount": clip.views_count || 0
          },
          {
            "@type": "InteractionCounter",
            "interactionType": "http://schema.org/LikeAction",
            "userInteractionCount": clip.likes_count || 0
          }
        ],
        "author": {
          "@type": "Person",
          "name": clip.username,
          "url": `https://merrouchgaming.com/profile/${clip.username}`
        },
        "publisher": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "logo": {
            "@type": "ImageObject",
            "url": "https://merrouchgaming.com/logo.png"
          }
        },
        "genre": clip.game,
        "keywords": [clip.game, "gaming", "gameplay", "highlights", clip.username].join(",")
      }),
      openGraph: {
        title: `${clip.title} by ${clip.username} | Merrouch Gaming`,
        description,
        url: `https://merrouchgaming.com/clip/${id}`,
        type: 'video.other',
        video: {
          url: videoUrl,
          type: 'video/mp4',
          width: 1280,
          height: 720
        },
        images: [
          {
            url: thumbnailUrl,
            width: 1280,
            height: 720,
            alt: `${clip.title} - ${clip.game} gameplay by ${clip.username}`
          }
        ],
        site_name: 'Merrouch Gaming'
      },
      twitter: {
        card: 'player',
        site: '@merrouchgaming',
        title: `${clip.title} by ${clip.username}`,
        description,
        image: thumbnailUrl,
        player: {
          url: `https://merrouchgaming.com/clip/${id}`,
          width: 1280,
          height: 720
        }
      }
    };

    return {
      props: {
        initialSession: session,
        clip,
        metaData,
        isOwnClip: !!isOwner,
        isPrivate: !!isPrivate
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return { notFound: true };
  }
}

const ClipPage = ({ clip, metaData, isOwnClip, isPrivate }) => {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const supabase = createClient();

  // Add debug logging
  useEffect(() => {
    console.log('Client side checks:');
    console.log('Is Owner:', isOwnClip);
    console.log('Is Private:', isPrivate);
    console.log('Current user:', user?.username);
    console.log('Clip owner:', clip?.username);
  }, [isOwnClip, isPrivate, user, clip]);

  const handleClipDelete = async () => {
    // Add security check before deletion
    if (!isLoggedIn || !isOwnClip) {
      router.push('/login');
      return;
    }

    try {
      // Delete the clip from Supabase
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clip.id)
        .eq('username', user.username);

      if (error) throw error;

      await router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting clip:', error);
      alert('Failed to delete clip');
    }
  };

  if (isPrivate && (!isLoggedIn || !isOwnClip)) {
    return (
      <ProtectedPageWrapper>
        <DynamicMeta {...metaData} />
        <main className="private-clip-container">
          <div className="private-message">
            <h1>This clip is private</h1>
            <p>This content is only visible to its owner.</p>
            <button onClick={() => router.push('/')}>
              Go Home
            </button>
          </div>
          <style jsx>{`
            .private-clip-container {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 60vh;
              padding: 2rem;
            }
            .private-message {
              text-align: center;
              background: rgba(0, 0, 0, 0.5);
              padding: 2rem;
              border-radius: 8px;
              max-width: 400px;
            }
            .private-message h1 {
              margin-bottom: 1rem;
              color: #fff;
            }
            .private-message p {
              margin-bottom: 1.5rem;
              color: #ccc;
            }
            button {
              background: #FFD700;
              color: #000;
              border: none;
              padding: 0.5rem 1.5rem;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
              transition: all 0.3s ease;
            }
            button:hover {
              background: #FFC107;
              transform: translateY(-2px);
            }
          `}</style>
        </main>
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main>
        <div className="clip-container">
          <VideoPlayer
            clip={clip}
            user={user}
            supabase={supabase}
            isOwner={isOwnClip}
            onClipDelete={handleClipDelete}
          />
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default ClipPage; 