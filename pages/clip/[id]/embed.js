import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';

const VideoPlayer = dynamic(() => import('../../../components/VideoPlayer'), {
  ssr: false
});

export default function ClipEmbed({ clip }) {
  const router = useRouter();
  const { id } = router.query;

  if (!clip || !clip.cloudflare_uid) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        color: '#fff'
      }}>
        Clip not available
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{clip.title} | Merrouch Gaming</title>
      </Head>
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        background: '#000' 
      }}>
        <VideoPlayer 
          cloudflareUID={clip.cloudflare_uid}
          autoPlay
          controls
          isEmbed
          loop
          muted={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
    </>
  );
}

export async function getServerSideProps({ params, res }) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: clip } = await supabase
      .from('clips')
      .select('id, title, cloudflare_uid, visibility')
      .eq('id', params.id)
      .single();

    // If clip doesn't exist or is private
    if (!clip || clip.visibility !== 'public') {
      return {
        props: {
          clip: null
        }
      };
    }

    // Set cache headers for better performance
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=59'
    );

    return {
      props: {
        clip
      }
    };
  } catch (error) {
    console.error('Error fetching clip for embed:', error);
    return {
      props: {
        clip: null
      }
    };
  }
} 