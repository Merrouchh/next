import { useState, useEffect } from 'react';
import DynamicMeta from '../components/DynamicMeta';
import styles from '../styles/Home.module.css';
import { createClient } from '../utils/supabase/component';

export default function TestMeta() {
  const [type, setType] = useState('clip');
  const [clipMeta, setClipMeta] = useState(null);
  const [profileMeta, setProfileMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const SUPABASE_URL = 'https://qdbtccrhcidxllycuxnw.supabase.co';

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch the most recent public clip
        const { data: clip, error: clipError } = await supabase
          .from('clips')
          .select(`
            id,
            user_id,
            username,
            title,
            thumbnail_path,
            uploaded_at
          `)
          .eq('visibility', 'public')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .single();

        if (clipError) {
          console.error('Error fetching clip:', clipError);
        }

        if (clip) {
          const thumbnailUrl = clip.thumbnail_path 
            ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${clip.thumbnail_path}`
            : 'https://merrouchgaming.com/top.jpg';

          setClipMeta({
            title: `Gaming Clip by ${clip.username} | Merrouch Gaming`,
            description: clip.title || 'Amazing gaming moment captured at Cyber Merrouch Gaming Center in Tangier.',
            image: thumbnailUrl,
            url: `https://merrouchgaming.com/clip/${clip.id}`,
            type: 'video.other'
          });
        }

        // Fetch lda4 user profile
        const { data: testUser, error: userError } = await supabase
          .from('users')
          .select('username')
          .eq('username', 'lda4')
          .single();

        if (userError) {
          console.error('Error fetching user:', userError);
        }

        if (testUser) {
          // Get latest clip for this user
          const { data: userClips } = await supabase
            .from('clips')
            .select('thumbnail_path, title')
            .eq('username', testUser.username)
            .eq('visibility', 'public')
            .order('uploaded_at', { ascending: false })
            .limit(1);

          const latestClipThumbnail = userClips?.[0]?.thumbnail_path
            ? `${SUPABASE_URL}/storage/v1/object/public/highlight-clips/${userClips[0].thumbnail_path}`
            : 'https://merrouchgaming.com/top.jpg';

          setProfileMeta({
            title: `${testUser.username}'s Gaming Profile | Merrouch Gaming`,
            description: userClips?.[0]?.title 
              ? `Latest highlight: ${userClips[0].title}. Check out more gaming highlights at Cyber Merrouch Gaming Center in Tangier.`
              : `Check out ${testUser.username}'s gaming highlights at Cyber Merrouch Gaming Center in Tangier.`,
            image: latestClipThumbnail,
            url: `https://merrouchgaming.com/profile/${testUser.username}`,
            type: 'profile'
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className={styles.container}>Loading...</div>;
  }

  if (!clipMeta && !profileMeta) {
    return (
      <div className={styles.container}>
        <h1>No data available</h1>
        <pre style={{ background: '#f5f5f5', padding: '20px' }}>
          {JSON.stringify({ clipMeta, profileMeta }, null, 2)}
        </pre>
      </div>
    );
  }

  const currentMeta = type === 'clip' ? clipMeta : profileMeta;

  return (
    <div className={styles.container}>
      <DynamicMeta {...currentMeta} />
      
      <main className={styles.main}>
        <h1>Meta Tags Test Page (Real Data)</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => setType('clip')} 
            style={{ 
              marginRight: '10px',
              background: type === 'clip' ? '#4CAF50' : '#ddd',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Clip Meta {clipMeta ? `(ID: ${clipMeta.url.split('/').pop()})` : ''}
          </button>
          <button 
            onClick={() => setType('profile')}
            style={{ 
              background: type === 'profile' ? '#4CAF50' : '#ddd',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Test Profile Meta {profileMeta ? `(${profileMeta.url.split('/').pop()})` : ''}
          </button>
        </div>

        <div style={{ textAlign: 'left', maxWidth: '600px' }}>
          <h2>Current Meta Tags:</h2>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: '20px',
            overflow: 'auto',
            borderRadius: '4px'
          }}>
            {JSON.stringify(currentMeta, null, 2)}
          </pre>

          {currentMeta?.image && (
            <>
              <h3>Preview Image:</h3>
              <img 
                src={currentMeta.image} 
                alt="Meta preview"
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  borderRadius: '4px',
                  marginTop: '10px'
                }}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
} 