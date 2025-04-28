import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import DynamicMeta from '../../components/DynamicMeta';
import styles from '../../styles/Profile.module.css';
import { createClient } from '../../utils/supabase/server-props';
import ProfileDashboard from '../../components/profile/ProfileDashboard';
import UploadButton from '../../components/profile/UploadButton';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import UserClips from '../../components/profile/UserClips';
import { FaVideo } from 'react-icons/fa';
import { useState, useEffect } from 'react';

// LoadingSpinner component
const LoadingSpinner = ({ message = "Loading profile..." }) => (
  <div className={styles.loadingContainer}>
    <div className={styles.spinner}>
      <div className={styles.spinnerInner}></div>
    </div>
    <p className={styles.loadingText}>{message}</p>
  </div>
);

export async function getServerSideProps({ req, res, params }) {
  const { username } = params;
  const normalizedUsername = username.toLowerCase();
  const supabase = createClient({ req, res });

  // Set cache headers
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=300'
  );

  try {
    // Fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, gizmo_id')
      .eq('username', normalizedUsername)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return {
        props: {
          username: normalizedUsername,
          metaData: {
            title: `Gaming Profile | Merrouch Gaming Center Tangier`,
            description: "This user profile could not be found.",
            image: "https://merrouchgaming.com/top.jpg",
            url: `https://merrouchgaming.com/profile/${normalizedUsername}`,
            type: "profile"
          }
        }
      };
    }

    // Get clips count and fetch the latest clip for the preview image
    const { count: clipsCount } = await supabase
      .from('clips')
      .select('id', { count: 'exact' })
      .eq('user_id', userData.id)
      .eq('visibility', 'public');

    // Fetch the user's latest public clip for the thumbnail
    const { data: latestClip } = await supabase
      .from('clips')
      .select('id, title, thumbnail_path, cloudflare_uid, game, views_count, likes_count')
      .eq('user_id', userData.id)
      .eq('visibility', 'public')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .single();

    // Count user's event participations
    const { count: eventsCount } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact' })
      .eq('user_id', userData.id);

    // Get the thumbnail URL from the latest clip or use default
    const profileImage = latestClip?.cloudflare_uid 
      ? `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${latestClip.cloudflare_uid}/thumbnails/thumbnail.jpg`
      : latestClip?.thumbnail_path || "https://merrouchgaming.com/top.jpg";

    // Create a more detailed and personalized description
    let userDescription = `${normalizedUsername}'s gaming profile at Merrouch Gaming Center`;
    
    if (clipsCount) {
      userDescription += ` featuring ${clipsCount} public gaming ${clipsCount === 1 ? 'clip' : 'clips'}`;
    }
    
    if (eventsCount) {
      userDescription += ` and participation in ${eventsCount} ${eventsCount === 1 ? 'event' : 'events'}`;
    }
    
    if (latestClip?.title) {
      userDescription += `. Latest clip: "${latestClip.title}"`;
      if (latestClip.game) {
        userDescription += ` in ${latestClip.game}`;
      }
      if (latestClip.views_count) {
        userDescription += ` with ${latestClip.views_count} ${latestClip.views_count === 1 ? 'view' : 'views'}`;
      }
    }
    
    userDescription += `. Check out their gaming achievements and statistics!`;

    return {
      props: {
        username: normalizedUsername,
        metaData: {
          title: `${normalizedUsername}'s Gaming Profile | Merrouch Gaming Center`,
          description: userDescription,
          image: profileImage,
          url: `https://merrouchgaming.com/profile/${normalizedUsername}`,
          type: "profile",
          openGraph: {
            title: `${normalizedUsername}'s Gaming Profile | Merrouch Gaming Center`,
            description: userDescription,
            images: [
              {
                url: profileImage,
                width: 1200,
                height: 630,
                alt: `${normalizedUsername}'s Gaming Profile`
              }
            ],
            type: "profile",
            profile: {
              username: normalizedUsername
            }
          },
          twitter: {
            card: "summary_large_image",
            site: "@merrouchgaming",
            title: `${normalizedUsername}'s Gaming Profile | Merrouch Gaming Center`,
            description: userDescription,
            image: profileImage
          }
        }
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        username: normalizedUsername,
        metaData: {
          title: `Gaming Profile | Merrouch Gaming Center Tangier`,
          description: "View this user's gaming profile, achievements, and statistics at Merrouch Gaming Center.",
          image: "https://merrouchgaming.com/top.jpg",
          url: `https://merrouchgaming.com/profile/${normalizedUsername}`,
          type: "profile"
        }
      }
    };
  }
}

const ProfilePage = ({ username, metaData }) => {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userAchievements, setUserAchievements] = useState([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [error, setError] = useState(null);

  // Determine if current user is profile owner after userData loads
  const isOwner = user?.id && userData?.id ? user.id === userData.id : false;

  // Fetch the user data on client side
  useEffect(() => {
    setMounted(true);
    
    const fetchUserData = async () => {
      try {
        // Fetch user data
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
          .eq('username', username)
          .single();

        if (userError || !userData) {
          console.error('User not found:', userError);
          setError('User not found');
          setLoadingUser(false);
          return;
        }

        // Get clips count
        const { count: clipsCount } = await supabase
          .from('clips')
          .select('id', { count: 'exact' })
          .eq('user_id', userData.id)
          .eq('visibility', 'public');

        // Set the user data with clips count
        setUserData({
          ...userData,
          clips_count: clipsCount || 0
        });
        setLoadingUser(false);

        // Update meta data with user info
        updateMetaData(userData, clipsCount);
        
        // Now fetch achievements for this user
        fetchAchievements(userData.id);
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('Failed to load user profile');
        setLoadingUser(false);
      }
    };

    if (supabase && username && mounted) {
      fetchUserData();
    }
  }, [username, supabase, mounted]);

  // Function to update meta data with user info
  const updateMetaData = (userData, clipsCount) => {
    // This would normally update the page's meta data
    // For Next.js, we'd typically use a meta data component
    // This is left as a placeholder as this would normally
    // be handled by Next.js head management
    console.log('Updated meta data with user info');
  };

  // Fetch achievements 
  const fetchAchievements = async (userId) => {
    if (!userId) return;
    
    try {
      const registrationsPromise = supabase
        .from('event_registrations')
        .select('id, event_id, status, username')
        .eq('user_id', userId);
        
      const teamMembershipsPromise = supabase
        .from('event_team_members')
        .select('registration_id, username')
        .eq('user_id', userId);
        
      const [
        { data: userRegistrations, error: regError },
        { data: teamMemberships, error: teamError }
      ] = await Promise.all([registrationsPromise, teamMembershipsPromise]);
      
      if (regError) console.error('Error fetching registrations:', regError);
      if (teamError) console.error('Error fetching team memberships:', teamError);
      
      // If there are either registrations or team memberships, fetch the events data
      if ((userRegistrations && userRegistrations.length > 0) || 
          (teamMemberships && teamMemberships.length > 0)) {
        
        // Process and combine registrations
        let allRegistrations = [...(userRegistrations || [])];
        let registrationIdsForTeamLookup = [];
        
        // Get the team registrations if there are any team memberships
        if (teamMemberships && teamMemberships.length > 0) {
          const registrationIds = teamMemberships.map(member => member.registration_id);
          registrationIdsForTeamLookup = [...registrationIds];
          
          const { data: teamRegistrations } = await supabase
            .from('event_registrations')
            .select('id, event_id, username, status')
            .in('id', registrationIds);
          
          if (teamRegistrations) {
            // Add unique team registrations
            teamRegistrations.forEach(teamReg => {
              const isDuplicate = allRegistrations.some(reg => reg.event_id === teamReg.event_id);
              if (!isDuplicate) {
                allRegistrations.push({
                  ...teamReg,
                  isTeamMember: true
                });
              } else {
                // Update the registration to mark it as a team event when it's both a direct registration
                // and a team member registration
                const existingRegIndex = allRegistrations.findIndex(reg => reg.event_id === teamReg.event_id);
                if (existingRegIndex !== -1) {
                  allRegistrations[existingRegIndex].isTeamMember = true;
                }
              }
            });
          }
        }
        
        // Get event details if we have registrations
        if (allRegistrations.length > 0) {
          const eventIds = allRegistrations.map(reg => reg.event_id);
          
          const { data: eventsData } = await supabase
            .from('events')
            .select('id, title, game, status, date, time, team_type')
            .in('id', eventIds);
          
          // Determine which registrations are for team events (including duo events)
          const teamRegistrationIds = allRegistrations
            .filter(reg => {
              const event = eventsData?.find(e => e.id === reg.event_id);
              return event?.team_type === 'team' || event?.team_type === 'duo';
            })
            .map(reg => reg.id);
          
          // Include team registration IDs from team memberships as well
          if (registrationIdsForTeamLookup.length > 0) {
            // Make sure all known team registrations are included
            registrationIdsForTeamLookup.forEach(regId => {
              if (!teamRegistrationIds.includes(regId)) {
                teamRegistrationIds.push(regId);
              }
            });
          }
          
          console.log('Team registration IDs:', teamRegistrationIds);
          
          // Fetch partner information for team events
          let partners = [];
          if (teamRegistrationIds.length > 0) {
            try {
              // First try the direct team_members query
              const { data: teamPartners, error: partnerError } = await supabase
                .from('event_team_members')
                .select('registration_id, user_id, username')
                .in('registration_id', teamRegistrationIds)
                .neq('user_id', userId); // Exclude the current user
              
              if (partnerError) {
                console.error('Error fetching team partners:', partnerError);
              } else {
                partners = teamPartners || [];
                console.log('Found partners:', partners);
              }
              
              // If no partners found through direct query, try with a broader approach
              if (!partners || partners.length === 0) {
                console.log('Using alternative partner lookup method for public profile');
                
                // Get all registrations for these events
                const eventIds = eventsData.map(e => e.id);
                
                // First get all registrations for these events
                const { data: allEventRegistrations } = await supabase
                  .from('event_registrations')
                  .select('id, event_id, user_id')
                  .in('event_id', eventIds);
                
                if (allEventRegistrations && allEventRegistrations.length > 0) {
                  // Then get all team members for these registrations
                  const allRegIds = allEventRegistrations.map(reg => reg.id);
                  
                  const { data: allTeamMembers } = await supabase
                    .from('event_team_members')
                    .select('registration_id, user_id, username')
                    .in('registration_id', allRegIds);
                  
                  if (allTeamMembers) {
                    // Filter only the ones that match our target registrations
                    partners = allTeamMembers.filter(
                      member => 
                        teamRegistrationIds.includes(member.registration_id) && 
                        member.user_id !== userId
                    );
                    console.log('Partners found with alternative method:', partners);
                  }
                }
              }
            } catch (partnerFetchError) {
              console.error('Error in partner lookup:', partnerFetchError);
            }
          }
          
          // If still no partners found, try the event-based lookup
          if (!partners || partners.length === 0) {
            console.log('Using event-based partner lookup method');
            
            // For each event, find all users who participated
            for (const event of eventsData) {
              if (event.team_type === 'team' || event.team_type === 'duo') {
                // Get all registrations for this event
                const { data: eventRegistrations } = await supabase
                  .from('event_registrations')
                  .select('id, user_id, username, event_id')
                  .eq('event_id', event.id);
                
                if (eventRegistrations && eventRegistrations.length > 0) {
                  // Find registrations that aren't this user
                  const otherRegistrations = eventRegistrations.filter(reg => 
                    reg.user_id !== userId
                  );
                  
                  // Add them as potential partners
                  otherRegistrations.forEach(reg => {
                    // Create a synthetic team member entry
                    partners.push({
                      registration_id: reg.id,
                      user_id: reg.user_id,
                      username: reg.username,
                      event_id: reg.event_id
                    });
                  });
                }
              }
            }
            
            console.log('Partners found with event-based method:', partners);
          }
          
          if (eventsData && eventsData.length > 0) {
            // Create achievement objects for each event
            const achievements = eventsData.map(event => {
              const eventDate = new Date(`${event.date}T${event.time || '00:00:00'}`).toISOString();
              const reg = allRegistrations.find(r => r.event_id === event.id);
              
              // Find partners for this specific registration
              let eventPartners = [];
              if (reg && reg.id) {
                // First try registration-based lookup
                eventPartners = partners.filter(p => p.registration_id === reg.id);
              } 
              
              // If no partners found with registration ID, try event ID
              if (eventPartners.length === 0 && (event.team_type === 'team' || event.team_type === 'duo')) {
                // Look for partners that have been associated with this event ID directly
                eventPartners = partners.filter(p => p.event_id === event.id);
                
                // If still no partners, try looking at alternative registrations
                if (eventPartners.length === 0) {
                  const eventRegs = allRegistrations.filter(r => r.event_id === event.id && r.id);
                  const eventRegIds = eventRegs.map(r => r.id);
                  eventPartners = partners.filter(p => eventRegIds.includes(p.registration_id));
                }
              }
              
              return {
                eventId: event.id,
                eventTitle: event.title,
                game: event.game || 'Gaming Tournament',
                eventDate: eventDate,
                teamType: event.team_type,
                status: event.status,
                isWinner: false, // We'll skip winner checking for better performance
                isTeamMember: reg?.isTeamMember || false,
                partners: eventPartners || []
              };
            });
            
            setUserAchievements(achievements);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoadingAchievements(false);
    }
  };

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

  if (!mounted) {
    return (
      <ProtectedPageWrapper>
        <LoadingSpinner />
      </ProtectedPageWrapper>
    );
  }

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.errorContainer}>
          <h2 className={styles.errorTitle}>Error</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            onClick={() => router.back()}
            className={styles.backButton}
          >
            Go Back
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (loadingUser) {
    return (
      <ProtectedPageWrapper>
        <LoadingSpinner message={`Loading ${username}'s profile...`} />
      </ProtectedPageWrapper>
    );
  }

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      
      <main className={styles.profileMain}>
        <ProfileDashboard 
          user={userData}
          profiles={{
            user_id: userData.id,
            discord_id: userData.discord_id,
            valorant_id: userData.valorant_id,
            fortnite_name: userData.fortnite_name,
            battlenet_id: userData.battlenet_id
          }}
          achievements={userAchievements}
          isOwner={isOwner}
          loadingAchievements={loadingAchievements}
        />

        {/* Clips Section with container */}
        <div className="dashboard-section">
          <div 
            className="dashboard-section-header"
            style={{ cursor: 'default', border: 'none', width: '100%', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FaVideo className="dashboard-section-icon" />
              <h3 className="dashboard-section-title">Clips ({userData.clips_count || 0})</h3>
            </div>
            {isOwner && <UploadButton isCompact={true} />}
          </div>
          <div>
            <UserClips userId={userData.id} isOwner={isOwner} />
          </div>
        </div>
      </main>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;