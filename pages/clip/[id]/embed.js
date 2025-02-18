import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';
import styles from '../../../styles/Embed.module.css';

const VideoPlayer = dynamic(() => import('../../../components/VideoPlayer'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      Loading player...
    </div>
  )
});

export default function ClipEmbed({ clip }) {
  const router = useRouter();

  // Show loading state while clip data is being fetched
  if (router.isFallback) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  // Show error state if no clip data
  if (!clip || !clip.cloudflare_uid) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Clip not available</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{clip.title} | Merrouch Gaming</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className={styles.container}>
        <div className={styles.playerWrapper}>
          <VideoPlayer 
            cloudflareUID={clip.cloudflare_uid}
            autoPlay
            controls
            isEmbed
            loop
            muted={false}
          />
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ params, res }) {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Fetch clip data
    const { data: clip, error } = await supabase
      .from('clips')
      .select(`
        id,
        title,
        cloudflare_uid,
        visibility,
        username
      `)
      .eq('id', params.id)
      .single();

    // Handle errors or non-public clips
    if (error || !clip || clip.visibility !== 'public') {
      return {
        props: {
          clip: null
        }
      };
    }

    // Set cache headers
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