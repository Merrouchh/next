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
    
    // Fetch user's event participation data - both direct registrations and team memberships
    // First, get all event registrations where the user is the main registrant
    const { data: userRegistrations, error: regError } = await supabase
      .from('event_registrations')
      .select(`
        id,
        event_id,
        username,
        status
      `)
      .eq('user_id', userData.id);
    
    if (regError) {
      console.error('Error fetching user registrations:', regError);
    }
    
    // Next, get all team memberships where the user is a partner/team member
    const { data: teamMemberships, error: teamMemberError } = await supabase
      .from('event_team_members')
      .select(`
        registration_id,
        username
      `)
      .eq('user_id', userData.id);
    
    if (teamMemberError) {
      console.error('Error fetching team memberships:', teamMemberError);
    }
    
    // If user has team memberships, get the associated registration details
    let teamRegistrations = [];
    if (teamMemberships && teamMemberships.length > 0) {
      const registrationIds = teamMemberships.map(member => member.registration_id);
      
      const { data: regDetails, error: regDetailsError } = await supabase
        .from('event_registrations')
        .select(`
          id,
          event_id,
          username,
          status
        `)
        .in('id', registrationIds);
      
      if (regDetailsError) {
        console.error('Error fetching team registration details:', regDetailsError);
      } else if (regDetails) {
        teamRegistrations = regDetails;
      }
    }
    
    // Combine direct registrations and team registrations, avoiding duplicates
    const allRegistrations = [...(userRegistrations || [])];
    
    // Add team registrations but avoid duplicates (in case the user is both registrant and team member)
    if (teamRegistrations && teamRegistrations.length > 0) {
      teamRegistrations.forEach(teamReg => {
        const isDuplicate = allRegistrations.some(reg => reg.event_id === teamReg.event_id);
        if (!isDuplicate) {
          // Add a flag to indicate this is a team participation, not direct registration
          allRegistrations.push({
            ...teamReg,
            isTeamMember: true
          });
        }
      });
    }
    
    // If there are registrations, get the event details
    let achievements = [];
    if (allRegistrations && allRegistrations.length > 0) {
      const eventIds = allRegistrations.map(reg => reg.event_id);
      
      // Get basic event info
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          game,
          status,
          date,
          time,
          team_type
        `)
        .in('id', eventIds);
      
      if (eventsError) {
        console.error('Error fetching events data:', eventsError);
      } else if (eventsData && eventsData.length > 0) {
        // For team events, get team members
        const registrationIds = allRegistrations.map(reg => reg.id);
        
        // Create a mapping of partner data by registration ID
        let teamMembersByRegId = {};
        
        // For duo and team events, get the partners
        const { data: teamMembers, error: teamMembersError } = await supabase
          .from('event_team_members')
          .select(`
            registration_id,
            user_id,
            username
          `)
          .in('registration_id', registrationIds);
        
        if (teamMembersError) {
          console.error('Error fetching team members:', teamMembersError);
        } else if (teamMembers && teamMembers.length > 0) {
          // Group team members by registration ID
          teamMembers.forEach(member => {
            if (!teamMembersByRegId[member.registration_id]) {
              teamMembersByRegId[member.registration_id] = [];
            }
            // Only add team members that aren't the current user
            if (member.user_id !== userData.id) {
              teamMembersByRegId[member.registration_id].push(member);
            }
          });
        }
        
        // Create a mapping of registration info by event ID for quick lookup
        const registrationByEvent = {};
        allRegistrations.forEach(reg => {
          registrationByEvent[reg.event_id] = reg;
        });
        
        // For completed events, check if user is a winner
        const completedEventIds = eventsData
          .filter(event => event.status === 'Completed')
          .map(event => event.id);
        
        // For each completed event, check bracket data to see if user is a winner
        let winnerInfo = {};
        
        if (completedEventIds.length > 0) {
          // Fetch bracket data for completed events to check winners
          for (const eventId of completedEventIds) {
            const { data: bracketData, error: bracketError } = await supabase
              .from('event_brackets')
              .select('matches')
              .eq('event_id', eventId)
              .single();
            
            if (!bracketError && bracketData && bracketData.matches) {
              try {
                // The bracket data is an array of rounds, each containing match objects
                // Check if matches is already an object or needs to be parsed
                const bracketMatches = typeof bracketData.matches === 'string' 
                  ? JSON.parse(bracketData.matches) 
                  : bracketData.matches;
                
                console.log(`Event ID ${eventId}: Found bracket with ${bracketMatches.length} rounds`);
                
                // Find the final match (last round, first match)
                if (bracketMatches.length > 0) {
                  const finalRound = bracketMatches[bracketMatches.length - 1];
                  console.log(`Final round found with ${finalRound ? finalRound.length : 0} matches`);
                  
                  if (finalRound && finalRound.length > 0) {
                    const finalMatch = finalRound[0]; // The final match
                    console.log(`Final match:`, JSON.stringify(finalMatch));
                    
                    if (finalMatch && finalMatch.winnerId) {
                      const winningParticipantId = finalMatch.winnerId;
                      console.log(`Event ID ${eventId}: Final match winner ID is ${winningParticipantId}`);
                      
                      // Check if this user is the winner by username comparison
                      const userReg = registrationByEvent[eventId];
                      let isWinner = false;
                      
                      // Direct check - is this user the winner?
                      if (userReg) {
                        console.log(`User registration for event ${eventId}:`, userReg.username);
                        // Compare normalized usernames for case-insensitive matching
                        const normalizedUsername = userReg.username.toLowerCase();
                        
                        // Check if user is one of the participants in the final match
                        const isParticipant1 = finalMatch.participant1Name && 
                          finalMatch.participant1Name.toLowerCase() === normalizedUsername;
                        const isParticipant2 = finalMatch.participant2Name && 
                          finalMatch.participant2Name.toLowerCase() === normalizedUsername;
                        
                        if (isParticipant1) {
                          console.log(`User ${userReg.username} is participant1 in final match with ID: ${finalMatch.participant1Id}`);
                          isWinner = finalMatch.participant1Id === winningParticipantId;
                        } else if (isParticipant2) {
                          console.log(`User ${userReg.username} is participant2 in final match with ID: ${finalMatch.participant2Id}`);
                          isWinner = finalMatch.participant2Id === winningParticipantId;
                        }
                        
                        // If user wasn't in the final match, search other matches for their ID
                        if (!isParticipant1 && !isParticipant2) {
                          // Find this user's participant ID in the bracket
                          let userParticipantId = null;
                          
                          // Search all rounds and matches for this username
                          for (let r = 0; r < bracketMatches.length; r++) {
                            const round = bracketMatches[r];
                            for (let m = 0; m < round.length; m++) {
                              const match = round[m];
                              if (match.participant1Name && match.participant1Name.toLowerCase() === normalizedUsername) {
                                userParticipantId = match.participant1Id;
                                console.log(`Found user ${normalizedUsername} as participant1 in round ${r+1}, match ${m+1}, ID: ${userParticipantId}`);
                                break;
                              } else if (match.participant2Name && match.participant2Name.toLowerCase() === normalizedUsername) {
                                userParticipantId = match.participant2Id;
                                console.log(`Found user ${normalizedUsername} as participant2 in round ${r+1}, match ${m+1}, ID: ${userParticipantId}`);
                                break;
                              }
                            }
                            if (userParticipantId) break;
                          }
                          
                          // If we have the user's participant ID, check if it matches the winner ID
                          if (userParticipantId) {
                            isWinner = userParticipantId === winningParticipantId;
                            console.log(`Comparing user ID ${userParticipantId} with winner ID ${winningParticipantId}: ${isWinner}`);
                          }
                        }
                      }
                      
                      if (isWinner) {
                        console.log(`🏆 User ${userData.username} is a WINNER for event ${eventId}!`);
                        winnerInfo[eventId] = true;
                      } else {
                        console.log(`User ${userData.username} is NOT a winner for event ${eventId}`);
                      }
                    } else {
                      console.log(`No winnerId found in final match for event ${eventId}`);
                    }
                  } else {
                    console.log(`No valid final match found for event ${eventId}`);
                  }
                } else {
                  console.log(`No bracket rounds found for event ${eventId}`);
                }
              } catch (parseError) {
                console.error('Error parsing bracket data:', parseError, bracketData.matches);
              }
            }
          }
        }
        
        // Prepare the user's achievements
        achievements = eventsData.map(event => {
          // Create ISO date string from separate date and time fields
          const eventDate = new Date(`${event.date}T${event.time || '00:00:00'}`).toISOString();
          
          const reg = registrationByEvent[event.id];
          const regId = reg?.id;
          const isTeamMember = reg?.isTeamMember || false;
          
          // Get partners/team members
          let partners = [];
          
          if (regId && teamMembersByRegId[regId]) {
            // Include team members as partners
            partners = teamMembersByRegId[regId].map(p => ({
              username: p.username,
              userId: p.user_id
            }));
          }
          
          // If this is a team membership (not main registrant), we need to include the main registrant
          if (isTeamMember && reg) {
            // Add the main registrant as a partner
            partners.push({
              username: reg.username,
              userId: null // We might not have the user ID of the registrant
            });
          }
          
          const isWinnerForEvent = !!winnerInfo[event.id];
          console.log(`Event ${event.id} (${event.title}): isWinner = ${isWinnerForEvent}, status = ${event.status}`);
          
          return {
            eventId: event.id,
            eventTitle: event.title,
            game: event.game || 'Gaming Tournament',
            eventDate: eventDate,
            teamType: event.team_type,
            status: event.status,
            isWinner: isWinnerForEvent,
            isTeamMember: isTeamMember,
            partners: partners
          };
        });
      }
    }

    // Set cache headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=300'
    );
    
    // Calculate how many gaming profiles user has connected
    const connectedProfiles = [
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
    }${
      achievements.length ? `. Participated in ${achievements.length} events` : ''
    }${
      achievements.filter(a => a.isWinner).length ? ` and won ${achievements.filter(a => a.isWinner).length} tournaments` : ''
    }. ${
      latestClipTitle ? `Latest clip: "${latestClipTitle}"` : ''
    }`;

    return {
      props: {
        userData: {
          ...userData,
          clips_count: clipsCount || 0
        },
        achievements: achievements || [],
        metaData: {
          title: `${userData.username}'s Gaming Profile | Merrouch Gaming Center Tangier`,
          description: description.substring(0, 155) + (description.length > 155 ? '...' : ''),
          image: profileImage,
          url: `https://merrouchgaming.com/profile/${userData.username}`,
          type: "profile",
          openGraph: {
            title: `${userData.username} | Gaming Profile | Merrouch Gaming Tangier`,
            description: description.substring(0, 155) + (description.length > 155 ? '...' : ''),
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
            title: `${userData.username} | Gaming Profile | Best Gaming Center in Tangier`,
            description: description.substring(0, 155) + (description.length > 155 ? '...' : ''),
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

const ProfilePage = ({ userData, metaData, achievements }) => {
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
        <ProfileDashboard 
          user={userData}
          profiles={{
            user_id: userData.id,
            discord_id: userData.discord_id,
            valorant_id: userData.valorant_id,
            fortnite_name: userData.fortnite_name,
            battlenet_id: userData.battlenet_id
          }}
          achievements={achievements}
          isOwner={isOwner}
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