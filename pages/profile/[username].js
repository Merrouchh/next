import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import DynamicMeta from '../../components/DynamicMeta';
import styles from '../../styles/Profile.module.css';
import { createClient } from '../../utils/supabase/server-props';
import ProfileHeader from '../../components/profile/ProfileHeader';
import GamingProfiles from '../../components/profile/GamingProfiles';
import UploadButton from '../../components/profile/UploadButton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import UserClips from '../../components/profile/UserClips';

export async function getServerSideProps({ req, res, params }) {
  const supabase = createClient({ req, res });
  const { username } = params;
  const normalizedUsername = username.toLowerCase();

  try {
    // First get basic user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        gizmo_id,
        discord_id,
        valorant_id,
        fortnite_name,
        battlenet_id
      `)
      .eq('username', normalizedUsername)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return {
        notFound: true
      };
    }

    // Get clips count and latest public clip thumbnail
    const { data: clipsData, count: clipsCount } = await supabase
      .from('clips')
      .select('thumbnail_path, title, cloudflare_uid', { count: 'exact' })
      .eq('user_id', userData.id)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1);

    // Get the thumbnail URL from the latest clip or use default
    let profileImage = 'https://merrouchgaming.com/top.jpg';
    let latestClipTitle = '';
    
    if (clipsData && clipsData.length > 0) {
      // Prefer cloudflare thumbnail if available
      if (clipsData[0].cloudflare_uid) {
        profileImage = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${clipsData[0].cloudflare_uid}/thumbnails/thumbnail.jpg`;
      } else if (clipsData[0].thumbnail_path) {
        profileImage = clipsData[0].thumbnail_path;
      }
      latestClipTitle = clipsData[0].title || '';
    }

    // Set cache headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    
    // Calculate how many gaming profiles user has connected
    const connectedProfiles = [
      userData.gizmo_id,
      userData.discord_id,
      userData.valorant_id,
      userData.fortnite_name,
      userData.battlenet_id
    ].filter(Boolean).length;
    
    // Create a rich description that includes gaming profile info
    const description = `${userData.username}'s gaming profile on Merrouch Gaming Center. ${
      clipsCount ? `Check out their ${clipsCount} gaming highlights` : 'View their gaming profile'
    }${
      connectedProfiles ? ` and ${connectedProfiles} connected gaming accounts` : ''
    }. ${
      latestClipTitle ? `Latest clip: "${latestClipTitle}"` : ''
    }`;

    return {
      props: {
        userData: {
          ...userData,
          clips_count: clipsCount || 0
        },
        metaData: {
          title: `${userData.username}'s Gaming Profile | Merrouch Gaming`,
          description: description,
          image: profileImage,
          url: `https://merrouchgaming.com/profile/${userData.username}`,
          type: "profile",
          openGraph: {
            title: `${userData.username} | Gaming Profile`,
            description: description,
            images: [
              {
                url: profileImage,
                width: 1200,
                height: 630,
                alt: `${userData.username}'s Gaming Profile`
              }
            ],
            type: "profile",
            profile: {
              username: userData.username
            }
          },
          twitter: {
            card: "summary_large_image",
            site: "@merrouchgaming",
            title: `${userData.username} | Gamer Profile`,
            description: `Gaming profile with ${clipsCount || 0} clips. Check out ${userData.username}'s highlights!`,
            image: profileImage
          },
          structuredData: {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            "dateModified": new Date().toISOString(),
            "headline": `${userData.username}'s Gaming Profile`,
            "description": description,
            "image": profileImage,
            "url": `https://merrouchgaming.com/profile/${userData.username}`,
            "author": {
              "@type": "Person",
              "name": userData.username
            },
            "mainEntity": {
              "@type": "Person",
              "name": userData.username,
              "identifier": userData.id,
              "url": `https://merrouchgaming.com/profile/${userData.username}`,
              "sameAs": [
                userData.discord_id ? `https://discord.com/users/${userData.discord_id}` : null,
                userData.valorant_id ? `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(userData.valorant_id)}` : null
              ].filter(Boolean)
            },
            "potentialAction": {
              "@type": "ViewAction",
              "target": `https://merrouchgaming.com/profile/${userData.username}`
            },
            "provider": {
              "@type": "Organization",
              "name": "Merrouch Gaming",
              "url": "https://merrouchgaming.com"
            }
          }
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      notFound: true
    };
  }
}

const ProfilePage = ({ userData, metaData }) => {
  const { user } = useAuth();
  const isOwner = user?.id === userData.id;
  const router = useRouter();
  

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${type} copied to clipboard!`, {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
        duration: 2000,
      });
    }).catch(() => {
      toast.error('Failed to copy text', {
        position: 'top-right'
      });
    });
  };

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      
      <main className={styles.profileMain}>
        <ProfileHeader 
          username={userData.username}
          gizmo_id={userData.gizmo_id}
          totalClips={userData.clips_count}
          isOwner={isOwner}
        />

        <GamingProfiles 
          profiles={{
            user_id: userData.id,
            discord_id: userData.discord_id,
            valorant_id: userData.valorant_id,
            fortnite_name: userData.fortnite_name,
            battlenet_id: userData.battlenet_id
          }}
          isOwner={isOwner}
          onCopy={handleCopy}
        />

        {isOwner && <UploadButton />}

        <UserClips userId={userData.id} isOwner={isOwner} />
      </main>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;