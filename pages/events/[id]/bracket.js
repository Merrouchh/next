import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaTrophy, FaUsers, FaPlus, FaMinus, FaExpand, FaCompress, FaClock } from 'react-icons/fa';
import styles from '../../../styles/Bracket.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import ProtectedPageWrapper from '../../../components/ProtectedPageWrapper';
import DynamicMeta from '../../../components/DynamicMeta';

// Component imports
import BracketView from '../../../components/bracket/BracketView';
import ParticipantsList from '../../../components/bracket/ParticipantsList';
import WinnerModal from '../../../components/bracket/WinnerModal';
import ZoomControls from '../../../components/bracket/ZoomControls';
import TournamentWinner from '../../../components/shared/TournamentWinner';

export async function getServerSideProps({ params, req, res }) {
  const { id } = params;
  
  // Disable caching to ensure fresh data after bracket regeneration
  // Cache headers removed
  
  // Default metadata for not found case
  const notFoundMetadata = {
    title: "Tournament Bracket Not Found | Merrouch Gaming",
    description: "The tournament bracket you're looking for doesn't exist or has been removed.",
    image: "https://merrouchgaming.com/bracket.jpg",
    url: `https://merrouchgaming.com/events/${id}/bracket`,
    type: "website"
  };
  
  try {
    // Use direct Supabase connection instead of API calls
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch event data directly from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return { props: { metaData: notFoundMetadata } };
    }

    // Try to fetch bracket data for SEO info
    let bracketData = null;
    let participants = [];
    let hasWinner = false;
    let champion = null;

    try {
      // Fetch bracket data directly
      const { data: bracket, error: bracketError } = await supabase
        .from('event_brackets')
        .select('matches')
        .eq('event_id', id)
        .single();

      // Fetch participants directly
      const { data: participantData, error: participantsError } = await supabase
        .from('event_registrations')
        .select(`
          id, 
          user_id, 
          username,
          event_team_members (
            id,
            user_id,
            username
          ),
          team_name
        `)
        .eq('event_id', id)
        .eq('status', 'registered');

      if (!bracketError && bracket?.matches) {
        bracketData = bracket.matches;
      }

      if (!participantsError && participantData) {
        participants = participantData;
      }

      // Check for winner if we have bracket data
      if (bracketData && bracketData.length > 0 && participants.length > 0) {
        const finalRound = bracketData[bracketData.length - 1];
        if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
          hasWinner = true;
          champion = participants.find(p => p.id === finalRound[0].winnerId);
        }
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      // Continue without bracket data
    }

    // Generate metadata based on available information
    let pageTitle = `${event.title} Tournament Bracket | Merrouch Gaming`;
    let pageDescription = `View the tournament bracket for ${event.title}. `;
    
    // Add event type and game info
    if (event.team_type) {
      const teamTypeText = event.team_type === 'solo' ? 'solo' : 
                          event.team_type === 'duo' ? 'duo team' : 'team';
      pageDescription += `This ${teamTypeText} competition `;
    }
    
    if (event.game) {
      pageDescription += `for ${event.game} `;
    }
    
    pageDescription += `features ${participants.length} participants. `;

    // Enhance metadata based on tournament status
    let ogTitle = pageTitle;
    let ogDescription = pageDescription;
    
    if (hasWinner && champion) {
      if (event.team_type === 'duo' && champion.event_team_members && champion.event_team_members.length > 0) {
        const partner = champion.event_team_members[0];
        pageTitle = `${champion.username} & ${partner.username} Win ${event.title} | Tournament Bracket`;
        pageDescription += `Congratulations to ${champion.username} & ${partner.username} for winning this tournament! View the complete bracket and match results.`;
        ogTitle = `${champion.username} & ${partner.username} Win ${event.title}`;
        ogDescription = `${champion.username} & ${partner.username} claimed victory in the ${event.title} tournament. View the complete bracket and match results.`;
      } else if (event.team_type === 'team' && champion.team_name) {
        pageTitle = `${champion.team_name} Wins ${event.title} | Tournament Bracket`;
        pageDescription += `Congratulations to ${champion.team_name} for winning this tournament! View the complete bracket and match results.`;
        ogTitle = `${champion.team_name} Wins ${event.title}`;
        ogDescription = `${champion.team_name} claimed victory in the ${event.title} tournament. View the complete bracket and match results.`;
      } else {
        pageTitle = `${champion.username} Wins ${event.title} | Tournament Bracket`;
        pageDescription += `Congratulations to ${champion.username} for winning this tournament! View the complete bracket and match results.`;
        ogTitle = `${champion.username} Wins ${event.title}`;
        ogDescription = `${champion.username} claimed victory in the ${event.title} tournament. View the complete bracket and match results.`;
      }
    } else if (event.status === 'In Progress') {
      pageTitle = `${event.title} - Live Tournament Bracket | Merrouch Gaming`;
      pageDescription += `Tournament is currently in progress. Follow the live bracket and see who advances to the next round!`;
      ogTitle = `${event.title} - Live Tournament Bracket`;
      ogDescription = `Follow the live tournament bracket for ${event.title}. See match results and track who advances to the finals!`;
    } else if (event.status === 'Upcoming') {
      pageDescription += `Tournament bracket will be generated once registration closes. Check back soon!`;
    } else if (!bracketData) {
      pageDescription += `Bracket has not been generated yet. Check back soon for the tournament structure!`;
    }
    
    // Create full metadata object
    const metadata = {
      title: pageTitle,
      description: pageDescription,
      image: event.image || "https://merrouchgaming.com/bracket.jpg",
      url: `https://merrouchgaming.com/events/${id}/bracket`,
      type: "website",
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: [
          {
            url: event.image || "https://merrouchgaming.com/bracket.jpg",
            width: 1200,
            height: 630,
            alt: `${event.title} Tournament Bracket`
          }
        ]
      },
      structuredData: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${event.title} Tournament`,
        "description": `Tournament bracket for ${event.title}, a ${event.team_type} ${event.game || 'gaming'} competition.`,
        "startDate": event.date,
        "endDate": event.date,
        "location": {
          "@type": "Place",
          "name": event.location || "Merrouch Gaming Center",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Tangier",
            "addressCountry": "MA"
          }
        },
        "image": event.image || "https://merrouchgaming.com/bracket.jpg",
        "organizer": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "url": "https://merrouchgaming.com"
        }
      }
    };
    
    // Add winner information to structured data if available
    if (hasWinner && champion) {
      if (event.team_type === 'duo' && champion.event_team_members && champion.event_team_members.length > 0) {
        const partner = champion.event_team_members[0];
        metadata.structuredData.winner = {
          "@type": "Team",
          "name": `${champion.username} & ${partner.username}`,
          "member": [
            {
              "@type": "Person",
              "name": champion.username
            },
            {
              "@type": "Person",
              "name": partner.username
            }
          ]
        };
      } else if (event.team_type === 'team' && champion.team_name) {
        metadata.structuredData.winner = {
          "@type": "Team",
          "name": champion.team_name
        };
      } else {
        metadata.structuredData.winner = {
          "@type": "Person",
          "name": champion.username
        };
      }
    }
    
    return { props: { metaData: metadata } };
  } catch (error) {
    console.error('Error fetching data for bracket SEO:', error);
    return { props: { metaData: notFoundMetadata } };
  }
}

export default function EventBracket({ metaData }) {
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase } = useAuth();
  const [event, setEvent] = useState(null);
  const [bracketData, setBracketData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [hasBracket, setHasBracket] = useState(true);
  const [tournamentChampion, setTournamentChampion] = useState(null);
  const [matchDetails, setMatchDetails] = useState([]);
  const [eventType, setEventType] = useState('solo'); // Default to solo
  const [isDuoEvent, setIsDuoEvent] = useState(false);

  // Add a safety timeout to ensure loading state is reset if it gets stuck
  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        console.log('Loading timeout reached, forcing loading state to false');
        setLoading(false);
        if (!error) {
          setError('Loading timed out. Please try refreshing the page.');
        }
      }, 10000); // 10 seconds timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [loading, error]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
      return;
    }
    
      // Simply use the isAdmin property that's already on the user object
      setIsAdmin(user.isAdmin === true);
      console.log("User data:", user);
      console.log("Admin status set to:", user.isAdmin === true);
    };

    checkAdminStatus();
  }, [user]);

  // Fetch event and bracket data
  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Add timestamp to bust browser cache
        const timestamp = Date.now();
        
        // Fetch event details
        const eventResponse = await fetch(`/api/events/${id}?t=${timestamp}`);
        
        if (!eventResponse.ok) {
          throw new Error('Failed to fetch event data');
        }
        
        const eventData = await eventResponse.json();
        console.log('Loaded event data:', eventData);
        setEvent(eventData);
        
        // Fetch bracket data
        const bracketResponse = await fetch(`/api/events/${id}/bracket?t=${timestamp}`);
        
        if (bracketResponse.status === 404) {
          console.log('Bracket not found');
          setHasBracket(false);
          setLoading(false);
          setBracketData(null);
          setParticipants([]);
          return;
        }
        
        if (!bracketResponse.ok) {
          throw new Error(`Failed to fetch bracket: ${bracketResponse.status}`);
        }
        
        const data = await bracketResponse.json();
        console.log('Loaded bracket data:', JSON.stringify(data, null, 2));
        
        if (data && data.bracket) {
          console.log('Setting bracket data with participants:', data.participants);
          
          // Get event type directly from the API response 
          const eventType = data.eventType || 'solo'; // Default to solo if not specified
          console.log('Event type from API:', eventType);
          
          // Update the eventType state
          setEventType(eventType);
          // Also set isDuoEvent for backward compatibility
          setIsDuoEvent(eventType === 'duo');
          
          // Ensure team names are included in participants data
          const participantsWithTeamNames = data.participants.map(participant => {
            // Extract team name from the participant data if available
            return {
              ...participant,
              // Use team_name property if it exists
              team_name: participant.team_name || null
            };
          });
          
          setBracketData(data.bracket);
          setParticipants(participantsWithTeamNames);
          setHasBracket(true);
          
          // Check for champion
          if (data.bracket.length > 0) {
            const finalRound = data.bracket[data.bracket.length - 1];
            if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
              const champion = data.participants.find(p => p.id === finalRound[0].winnerId);
              setTournamentChampion(champion || null);
            } else {
              setTournamentChampion(null);
            }
          }
          
          // Fetch match details for displaying scheduled times
          const matchDetailsResponse = await fetch(`/api/events/${id}/match-details?t=${timestamp}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (matchDetailsResponse.ok) {
            const matchDetailsData = await matchDetailsResponse.json();
            setMatchDetails(matchDetailsData.details || []);
            
            // Merge match details into bracket data
            if (matchDetailsData.details && matchDetailsData.details.length > 0) {
              console.log('Enriching bracket with match details...', matchDetailsData.details);
              
              const enrichedBracket = data.bracket.map(round => {
                return round.map(match => {
                  const details = matchDetailsData.details.find(d => d.match_id === match.id);
                  if (details) {
                    console.log(`Found details for match ${match.id}:`, details);
                    return {
                      ...match,
                      scheduledTime: details.scheduled_time || '',
                      location: details.location || '',
                      notes: details.notes || ''
                    };
                  }
                  return match;
                });
              });
              
              console.log('Setting enriched bracket data:', enrichedBracket);
              setBracketData(enrichedBracket);
            }
          }
        } else {
          setHasBracket(false);
          setBracketData(null);
          setParticipants([]);
        }
      } catch (error) {
        console.error('Error fetching bracket data:', error);
        setError('Failed to load bracket data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Generate bracket if admin
  const handleGenerateBracket = async () => {
    if (!isAdmin || !id) return;

    setLoading(true);
    setError(null);

    try {
      // Get the session for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        console.error('Authentication error:', sessionError || 'No access token');
        throw new Error('Authentication token not available');
      }

      // Generate bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate bracket: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.bracket) {
        setBracketData(data.bracket);
        setParticipants(data.participants || []);
      }
    } catch (error) {
      console.error('Error generating bracket:', error);
      setError(error.message || 'Failed to generate tournament bracket');
    } finally {
      setLoading(false);
    }
  };

  // Handle match click for admin
  const handleMatchClick = (match) => {
    console.log("Match clicked:", match);
    console.log("isAdmin status:", isAdmin);
    
    if (!isAdmin) {
      console.log("Not showing winner modal - user is not admin");
      return;
    }
    
    // Only allow selecting matches that have both participants and no winner yet
    if (match.participant1Id && match.participant2Id && !match.winnerId) {
      console.log("Setting selected match and showing winner modal");
      setSelectedMatch(match);
      setShowWinnerModal(true);
    } else {
      console.log("Not showing winner modal - match conditions not met:");
      console.log("- Has participant1Id:", !!match.participant1Id);
      console.log("- Has participant2Id:", !!match.participant2Id);
      console.log("- No winnerId:", !match.winnerId);
    }
  };

  // Set match winner
  const handleSetWinner = async (participantId) => {
    if (!isAdmin || !selectedMatch) return;

    setLoading(true);
    setError(null);

    try {
      // Get the session for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        console.error('Authentication error:', sessionError || 'No access token');
        throw new Error('Authentication token not available');
      }

      // Update match result
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          winnerId: participantId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update match: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.bracket) {
        setBracketData(data.bracket);
        setShowWinnerModal(false);
        setSelectedMatch(null);
      }
    } catch (error) {
      console.error('Error updating match:', error);
      setError(error.message || 'Failed to update match result');
    } finally {
      setLoading(false);
    }
  };

  // Add a function to delete the bracket (Only visible to admins with proper UI)
  const handleDeleteBracket = async () => {
    if (!isAdmin || !id) return;
    
    if (!confirm('Are you sure you want to delete this tournament bracket? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        console.error('Authentication error:', sessionError || 'No access token');
        throw new Error('Authentication token not available');
      }
      
      // Delete bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete bracket: ${response.status}`);
      }
      
      // Redirect back to the event page
      router.replace(`/events/${id}`);
    } catch (error) {
      console.error('Error deleting bracket:', error);
      setError(error.message || 'Failed to delete tournament bracket');
      setLoading(false);
    }
  };

  // Render a message if no bracket exists
  const renderNoBracketMessage = () => (
        <div className={styles.noBracketMessage}>
          {isAdmin ? (
            <>
              <p>No tournament bracket has been generated yet.</p>
              <button 
                className={styles.generateButton}
                onClick={handleGenerateBracket}
                disabled={loading}
              >
                Generate Bracket
              </button>
            </>
          ) : (
            <p>Tournament bracket has not been generated yet.</p>
          )}
        </div>
      );

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href={`/events/${id}`} className={styles.backLink}>
            <FaArrowLeft /> Back to Event
          </Link>
          <h1>{event ? event.title : 'Tournament'}</h1>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <div className={styles.loader}></div>
            <p>Loading tournament bracket...</p>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
            <Link href={`/events/${id}`} className={styles.backLink}>
              Back to Event
            </Link>
          </div>
        ) : (
          <div className={styles.content}>
            {!hasBracket ? renderNoBracketMessage() : (
              <BracketView
                bracketData={bracketData}
                participants={participants}
                eventType={eventType}
                isAdmin={isAdmin}
                handleMatchClick={handleMatchClick}
                tournamentChampion={tournamentChampion}
                handleDeleteBracket={handleDeleteBracket}
              />
            )}
            <ParticipantsList 
              participants={participants} 
              eventType={eventType}
            />
          </div>
        )}

        {showWinnerModal && selectedMatch && (
          <WinnerModal
            match={selectedMatch}
            participants={participants}
            onClose={() => setShowWinnerModal(false)}
            onSetWinner={handleSetWinner}
          />
        )}
      </div>
    </ProtectedPageWrapper>
  );
} 