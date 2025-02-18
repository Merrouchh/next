import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

const VideoPlayer = dynamic(() => import('../../../components/VideoPlayer'), {
  ssr: false
});

export default function ClipEmbed() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <VideoPlayer 
        clipId={id}
        autoPlay
        controls
        isEmbed
      />
    </div>
  );
}

export async function getServerSideProps({ params }) {
  // Fetch clip data and verify it's public
  // Return 404 if not found or not public
  return {
    props: {
      // clip data
    }
  };
} 