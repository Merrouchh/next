import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/Profile.module.css';
import { createClient } from '../../utils/supabase/server-props';
import ProfileDashboard from '../../components/profile/ProfileDashboard';
import UploadButton from '../../components/profile/UploadButton';
import UserClips from '../../components/profile/UserClips';
import { FaVideo, FaGamepad, FaPlus } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';

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

  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // Fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        gizmo_id, 
        favorite_game,
        discord_id,
        valorant_id,
        fortnite_name,
        battlenet_id,
        points
      `)
      .eq('username', normalizedUsername)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return {
        props: {
          username: normalizedUsername,
          // Server-side metadata now handled in _document.js
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
    
    if (userData.favorite_game) {
      userDescription += ` | ${userData.favorite_game} Player`;
    }
        
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
        // Server-side metadata now handled in _document.js
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        username: normalizedUsername,
        // Server-side metadata now handled in _document.js
      }
    };
  }
}

const ProfilePage = ({ username }) => {
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

  // Reset states when username changes
  useEffect(() => {
    setUserAchievements([]);
    setLoadingAchievements(true);
    setUserData(null);
    setLoadingUser(true);
    setError(null);
  }, [username]);

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
            battlenet_id,
            favorite_game,
            points
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

        // Get total clips count (public and private) for the owner
        let totalClipsCount = clipsCount;
        if (user && user.id === userData.id) {
          const { count: ownerClipsCount } = await supabase
            .from('clips')
            .select('id', { count: 'exact' })
            .eq('user_id', userData.id);
          totalClipsCount = ownerClipsCount || 0;
        }

        // Set the user data with clips count
        setUserData({
          ...userData,
          clips_count: clipsCount || 0,
          total_clips_count: totalClipsCount
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
              }
              
              // If we're viewing a team member's profile, also fetch and include team leaders (creators)
              if (teamRegistrationIds.length > 0) {
                // Get the registration owners (team leaders) for these registrations
                const { data: registrationOwners } = await supabase
                  .from('event_registrations')
                  .select('id, user_id, username, event_id')
                  .in('id', teamRegistrationIds)
                  .neq('user_id', userId); // Exclude the current user
                
                if (registrationOwners && registrationOwners.length > 0) {
                  // Format them as "partners" and add to the partners list
                  registrationOwners.forEach(owner => {
                    partners.push({
                      registration_id: owner.id,
                      user_id: owner.user_id,
                      username: owner.username,
                      event_id: owner.event_id,
                      isTeamLeader: true
                    });
                  });
                }
              }
              
              // If no partners found through direct query, try with a broader approach
              if (!partners || partners.length === 0) {
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
          }
          
          if (eventsData && eventsData.length > 0) {
            // Create achievement objects for each event
            const rawAchievements = eventsData.map(event => {
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
              
              const isWinnerPlaceholder = false; // placeholder until bracket API
              return {
                eventId: event.id,
                eventTitle: event.title,
                game: event.game || 'Gaming Tournament',
                eventDate,
                teamType: event.team_type,
                status: event.status,
                isWinner: isWinnerPlaceholder,
                isTeamMember: reg?.isTeamMember || false,
                partners: eventPartners || []
              };
            });
            
            // Wrap critical fetch logic in try-catch to ensure we display at least raw achievements on error
            try {
              // Enrich achievements by fetching bracket API to mark winners
              const enrichedAchievements = await Promise.all(
                rawAchievements.map(async ach => {
                  try {
                    const res = await fetch(`/api/events/${ach.eventId}/bracket`);
                    if (!res.ok) return ach;
                    const br = await res.json();
                    const matches = br.bracket;
                    const final = Array.isArray(matches) && matches.length > 0 ? matches[matches.length - 1] : null;
                    const winnerId = final && final[0]?.winnerId;
                    const regId = allRegistrations.find(r => r.event_id === ach.eventId)?.id;
                    const isWinner = regId != null && winnerId != null && String(winnerId) === String(regId);
                    return { ...ach, isWinner };
                  } catch (error) {
                    console.error(`Error fetching bracket for event ${ach.eventId}:`, error);
                    return ach;
                  }
                })
              );
              
              setUserAchievements(enrichedAchievements);
            } catch (enrichError) {
              console.error('Failed to enhance achievements with bracket data:', enrichError);
              // Fallback to raw achievements without bracket winner data
              setUserAchievements(rawAchievements);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
      setUserAchievements([]);
    } finally {
      setLoadingAchievements(false);
    }
  };

  if (!mounted) {
    return (
      <>
        <Head>
          <title>Loading Profile | Merrouch Gaming Center</title>
        </Head>
        <ProtectedPageWrapper>
          <LoadingSpinner />
        </ProtectedPageWrapper>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Profile Error | Merrouch Gaming Center</title>
        </Head>
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
      </>
    );
  }

  if (loadingUser) {
    return (
      <>
        <Head>
          <title>Loading {username}'s Profile | Merrouch Gaming Center</title>
        </Head>
        <ProtectedPageWrapper>
          <LoadingSpinner message={`Loading ${username}'s profile...`} />
        </ProtectedPageWrapper>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{username}'s Gaming Profile | Merrouch Gaming Center</title>
        <meta name="description" content={`View ${username}'s gaming profile, clips, achievements, and gaming statistics at Merrouch Gaming Center in Tangier.`} />
      </Head>
      
      <ProtectedPageWrapper>
        <main className={styles.profileContainer}>
        <header className={styles.profileHeader}>
          <h1 className={styles.profileTitle}>
            {isOwner ? 'YOUR GAMING PROFILE' : `${username}'s GAMING PROFILE`}
          </h1>
          {userData.favorite_game ? (
            <div className={styles.favoriteGame}>
              <FaGamepad style={{ marginRight: '5px' }} />
              <span>{userData.favorite_game} Player</span>
            </div>
          ) : isOwner ? (
            <Link href="/editprofile" className={styles.addFavoriteGame}>
              <FaPlus style={{ marginRight: '5px' }} />
              <span>+ Add your main game</span>
            </Link>
          ) : null}
        </header>
        
        {/* Profile Dashboard (Game Accounts & Events) - add key to force re-render */}
        <ProfileDashboard 
          key={`profile-${username}`}
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

        {/* Clips Section - add key to force re-render */}
        <section className={styles.clipsSection}>
          <div className={styles.clipsHeader}>
            <h2>
              <FaVideo style={{ marginRight: '10px' }} />
              CLIPS ({isOwner ? (userData.total_clips_count || 0) : (userData.clips_count || 0)})
            </h2>
            {isOwner && <UploadButton isCompact={true} />}
          </div>
          <div className={styles.clipsSectionContent}>
            <UserClips key={`clips-${username}`} userId={userData.id} isOwner={isOwner} />
          </div>
        </section>
      </main>
    </ProtectedPageWrapper>
    </>
  );
};

export default ProfilePage;