import { useRouter } from 'next/router';
import { createClient as createServerClient } from '../../utils/supabase/server-props';
import { createClient } from '../../utils/supabase/component';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import VideoPlayer from '../../components/VideoPlayer';
import DynamicMeta from '../../components/DynamicMeta';

export async function getServerSideProps({ req, res, params }) {
  res.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=0, must-revalidate'
  );

  const supabase = createServerClient({ req, res });
  const { id } = params;

  try {
    // Check session server-side
    const { data: { session } } = await supabase.auth.getSession();

    // Get clip data
    const { data: clip, error } = await supabase
      .from('clips')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !clip) {
      return { notFound: true };
    }

    // Prepare meta data
    const timestamp = Date.now();
    const previewImage = clip.thumbnail_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}?t=${timestamp}`
      : 'https://merrouchgaming.com/top.jpg';

    const metaData = {
      title: `${clip.title} by ${clip.username} | Merrouch Gaming`,
      description: `Watch this amazing ${clip.game} clip by ${clip.username} on Merrouch Gaming!`,
      image: previewImage,
      url: `https://merrouchgaming.com/clip/${id}`,
      type: 'video.other',
      openGraph: {
        title: `${clip.title} by ${clip.username} | Merrouch Gaming`,
        description: `Watch this amazing ${clip.game} clip by ${clip.username} on Merrouch Gaming!`,
        images: [{ url: previewImage, width: 1200, height: 630 }],
        video: clip.file_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.file_path}` : null,
        site_name: 'Merrouch Gaming'
      }
    };

    return {
      props: {
        initialSession: session,
        clip,
        metaData,
        isOwnClip: session?.user?.email === clip.email
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return { notFound: true };
  }
}

const ClipPage = ({ clip, metaData, isOwnClip }) => {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const handleClipDelete = async (_clipId) => {
    try {
      await router.push('/dashboard');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  return (
    <ProtectedPageWrapper>
      {/* Use DynamicMeta for meta tags */}
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