import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaTrophy, FaUsers, FaPlus, FaMinus, FaExpand, FaCompress, FaClock } from 'react-icons/fa';
import styles from '../../../styles/Bracket.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import ProtectedPageWrapper from '../../../components/ProtectedPageWrapper';
import DynamicMeta from '../../../components/DynamicMeta';

export async function getServerSideProps({ params, req, res }) {
  const { id } = params;
  
  // Disable caching to ensure fresh data after bracket regeneration
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Default metadata for not found case
  const notFoundMetadata = {
    title: "Tournament Bracket Not Found | Merrouch Gaming",
    description: "The tournament bracket you're looking for doesn't exist or has been removed.",
    image: "https://merrouchgaming.com/bracket.jpg",
    url: `https://merrouchgaming.com/events/${id}/bracket`,
    type: "website"
  };
  
  try {
    // Helper function to fetch with error handling
    const fetchWithErrorHandling = async (url, options = {}) => {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          const data = await response.json();
          return { success: true, data };
        }
        return { success: false, error: `Failed with status ${response.status}` };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    
    // Try fetching event data
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://merrouchgaming.com';
    let eventResult = await fetchWithErrorHandling(`${baseUrl}/api/events/${id}`);
    
    // If that fails, try with relative URL
    if (!eventResult.success) {
      eventResult = await fetchWithErrorHandling(`/api/events/${id}`, {
        headers: { 'x-forwarded-host': 'localhost:3000' }
      });
    }
    
    // If both fail, return not found
    if (!eventResult.success) {
      return { props: { metaData: notFoundMetadata } };
    }
    
    // Extract event data
    const event = eventResult.data.event || eventResult.data;
    
    // Try to fetch bracket data for SEO info
    let bracketResult = await fetchWithErrorHandling(`${baseUrl}/api/events/${id}/bracket`);
    
    // If that fails, try relative URL
    if (!bracketResult.success) {
      bracketResult = await fetchWithErrorHandling(`/api/events/${id}/bracket`, {
        headers: { 'x-forwarded-host': 'localhost:3000' }
      });
    }
    
    // Check for champion information in bracket data
    let champion = null;
    let hasWinner = false;
    
    if (bracketResult.success) {
      const bracketData = bracketResult.data;
      if (bracketData.bracket && bracketData.participants && bracketData.bracket.length > 0) {
        const finalRound = bracketData.bracket[bracketData.bracket.length - 1];
        if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
          hasWinner = true;
          champion = bracketData.participants.find(p => p.id === finalRound[0].winnerId);
        }
      }
    }
    
    // Generate appropriate title based on event type and winner status
    let pageTitle;
    let pageDescription;
    
    if (hasWinner) {
      if (event.team_type === 'duo' && champion && champion.members && champion.members.length > 0) {
        // For duo events with a winner, include both team members in the title
        const partnerName = champion.members[0]?.name || '';
        pageTitle = `${champion.name} & ${partnerName} Won ${event.title} | Tournament Bracket`;
        pageDescription = `Check out the complete tournament bracket for ${event.title}. ${champion.name} & ${partnerName} claimed victory in this ${event.game || 'gaming'} duo tournament.`;
      } else {
        // For solo or team events with a winner
        pageTitle = `${champion.name} Won ${event.title} | Tournament Bracket`;
        pageDescription = `Check out the complete tournament bracket for ${event.title}. ${champion.name} claimed victory in this ${event.game || 'gaming'} tournament.`;
      }
    } else {
      // No winner yet
      pageTitle = `${event.title} | Tournament Bracket | Merrouch Gaming`;
      pageDescription = `View the tournament bracket for ${event.title}, a ${event.team_type} ${event.game || 'gaming'} tournament at Merrouch Gaming. Follow the matches and discover who comes out on top.`;
    }
    
    // Generate appropriate OpenGraph title and description
    let ogTitle;
    let ogDescription;
    
    if (hasWinner) {
      if (event.team_type === 'duo' && champion && champion.members && champion.members.length > 0) {
        // For duo events with a winner, include both team members
        const partnerName = champion.members[0]?.name || '';
        ogTitle = `${champion.name} & ${partnerName} Won ${event.title} | Tournament Results`;
        ogDescription = `${champion.name} & ${partnerName} have won the ${event.game || 'gaming'} duo tournament! View the complete bracket and tournament results.`;
      } else {
        // For solo or team events with a winner
        ogTitle = `${champion.name} Won ${event.title} | Tournament Results`;
        ogDescription = `${champion.name} has won the ${event.game || 'gaming'} tournament! View the complete bracket and tournament results.`;
      }
    } else {
      // No winner yet
      ogTitle = `${event.title} | Tournament Bracket`;
      ogDescription = `Check out the tournament bracket for ${event.title}. Follow the matches in this ${event.team_type} ${event.game || 'gaming'} tournament.`;
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
      if (event.team_type === 'duo' && champion.members && champion.members.length > 0) {
        metadata.structuredData.winner = {
          "@type": "Team",
          "name": `${champion.name} & ${champion.members[0]?.name || ''}`,
          "member": [
            {
              "@type": "Person",
              "name": champion.name
            },
            {
              "@type": "Person",
              "name": champion.members[0]?.name || ''
            }
          ]
        };
      } else {
        metadata.structuredData.winner = {
          "@type": "Person",
          "name": champion.name
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
  const [connectorLines, setConnectorLines] = useState([]);
  const matchRefs = useRef({});
  const [zoomLevel, setZoomLevel] = useState(100);
  const bracketScrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const bracketWrapperRef = useRef(null);
  const [hasBracket, setHasBracket] = useState(true);
  const [tournamentChampion, setTournamentChampion] = useState(null);
  const [matchDetails, setMatchDetails] = useState([]);

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

  // Detect touch device
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }
  }, []);

  // Handle zoom functionality
  const handleZoomIn = () => {
    setHasInteracted(true);
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setHasInteracted(true);
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
    setHasInteracted(false); // Reset the interaction state
    
    // Position the bracket at the top-left
    if (bracketScrollRef.current) {
      const scrollContainer = bracketScrollRef.current;
      scrollContainer.scrollLeft = 0;
      scrollContainer.scrollTop = 0;
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const container = document.querySelector(`.${styles.bracketContainer}`);
      if (container && container.requestFullscreen) {
        container.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Update fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Mouse and touch event handlers for dragging
  const handleDragStart = (e) => {
    // Skip if clicking on a match or button
    if (e.target.closest(`.${styles.match}`) || 
        e.target.closest('button') ||
        e.target.tagName === 'A') {
      return;
    }
    
    // Prevent default to stop text selection and other browser behaviors
    e.preventDefault();
    e.stopPropagation();
    
    // Set hasInteracted to true
    setHasInteracted(true);
    
    // Get client position based on event type
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
    
    if (bracketScrollRef.current) {
      setScrollPos({
        x: bracketScrollRef.current.scrollLeft,
        y: bracketScrollRef.current.scrollTop
      });
      
      // Force cursor to grabbing
      document.body.style.cursor = 'grabbing';
      if (bracketWrapperRef.current) {
        bracketWrapperRef.current.classList.add('dragging');
      }
      bracketScrollRef.current.style.cursor = 'grabbing';
    }
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    // Prevent default to stop text selection and other browser behaviors
    e.preventDefault();
    e.stopPropagation();
    
    // Get client position based on event type
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
    
    // Calculate distance moved
    const dx = startPos.x - clientX;
    const dy = startPos.y - clientY;
    
    // Update scroll position with a multiplier for faster scrolling
    if (bracketScrollRef.current) {
      bracketScrollRef.current.scrollLeft = scrollPos.x + dx;
      bracketScrollRef.current.scrollTop = scrollPos.y + dy;
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Reset cursor and class
    document.body.style.cursor = '';
    if (bracketWrapperRef.current) {
      bracketWrapperRef.current.classList.remove('dragging');
    }
    
    if (bracketScrollRef.current) {
      bracketScrollRef.current.style.cursor = 'grab';
    }
  };

  // Add event listeners for drag functionality
  useEffect(() => {
    const scrollContainer = bracketScrollRef.current;
    if (!scrollContainer) return;
    
    // Mouse events
    const mouseDownHandler = (e) => handleDragStart(e);
    const mouseMoveHandler = (e) => handleDragMove(e);
    const mouseUpHandler = () => handleDragEnd();
    
    // Touch events
    const touchStartHandler = (e) => handleDragStart(e);
    const touchMoveHandler = (e) => handleDragMove(e);
    const touchEndHandler = () => handleDragEnd();
    
    // Add event listeners
    scrollContainer.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    document.addEventListener('mouseleave', mouseUpHandler);
    
    scrollContainer.addEventListener('touchstart', touchStartHandler, { passive: false });
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
    document.addEventListener('touchcancel', touchEndHandler);
    
    return () => {
      // Clean up event listeners
      scrollContainer.removeEventListener('mousedown', mouseDownHandler);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      document.removeEventListener('mouseleave', mouseUpHandler);
      
      scrollContainer.removeEventListener('touchstart', touchStartHandler);
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('touchend', touchEndHandler);
      document.removeEventListener('touchcancel', touchEndHandler);
      
      // Reset cursor and class
      document.body.style.cursor = '';
      if (bracketWrapperRef.current) {
        bracketWrapperRef.current.classList.remove('dragging');
      }
    };
  }, [isDragging, startPos, scrollPos, handleDragStart, handleDragMove, handleDragEnd]);

  // Update connector lines when bracket data changes or window resizes or zoom changes
  useEffect(() => {
    if (!bracketData || typeof window === 'undefined') return;

    // Function to generate connector lines
    const updateConnectorLines = () => {
      // Wait for refs to be populated and layout to stabilize
      setTimeout(() => {
        const lines = [];
        const bracketWrapper = document.querySelector(`.${styles.bracketWrapper}`);
        if (!bracketWrapper) return;
        
        const bracketRect = bracketWrapper.getBoundingClientRect();
        const scale = zoomLevel / 100; // Current scale factor
        
        // Loop through all rounds except the final
        for (let roundIndex = 0; roundIndex < bracketData.length - 1; roundIndex++) {
          const currentRound = bracketData[roundIndex];
          
          // Loop through matches in the current round
          for (let matchIndex = 0; matchIndex < currentRound.length; matchIndex++) {
            const match = currentRound[matchIndex];
            
            // Skip if no next match
            if (!match.nextMatchId) continue;
            
            // Find the source and target match elements
            const sourceRef = matchRefs.current[`match-${match.id}`];
            const targetRef = matchRefs.current[`match-${match.nextMatchId}`];
            
            // Skip if either ref is missing
            if (!sourceRef || !targetRef) continue;
            
            // Get the source and target match positions
            const sourceRect = sourceRef.getBoundingClientRect();
            const targetRect = targetRef.getBoundingClientRect();
            
            // Calculate relative positions
            const x1 = (sourceRect.right - bracketRect.left) / scale;
            const y1 = (sourceRect.top + sourceRect.height / 2 - bracketRect.top) / scale;
            const x2 = (targetRect.left - bracketRect.left) / scale;
            const y2 = (targetRect.top + targetRect.height / 2 - bracketRect.top) / scale;
            
            // Create path for the connector line
            const midX = x1 + (x2 - x1) / 2;
            const path = `M${x1},${y1} H${midX} V${y2} H${x2}`;
            
            // Add the line to the array
            lines.push(
              <path 
                key={`connector-${match.id}-${match.nextMatchId}`}
                d={path}
                className={styles.connector}
                strokeWidth="2.5"
              />
            );
          }
        }
        
        setConnectorLines(lines);
      }, 300); // Reduced timeout since we have fixed heights now
    };

    // Update connector lines initially
    updateConnectorLines();

    // Update connector lines when window resizes or zoom changes
    const handleResize = () => {
      updateConnectorLines();
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [bracketData, zoomLevel]);

  // Update connector lines when zoom changes
  useEffect(() => {
    if (!bracketData || typeof window === 'undefined') return;
    
    // Create a function to update connector lines after zoom
    const updateConnectorsAfterZoom = () => {
      // Wait for the transform to complete
      setTimeout(() => {
        const bracketWrapper = document.querySelector(`.${styles.bracketWrapper}`);
        if (!bracketWrapper) return;
        
        const lines = [];
        const bracketRect = bracketWrapper.getBoundingClientRect();
        const scale = zoomLevel / 100; // Current scale factor
        
        // Loop through all rounds except the final
        for (let roundIndex = 0; roundIndex < bracketData.length - 1; roundIndex++) {
          const currentRound = bracketData[roundIndex];
          
          // Loop through matches in the current round
          for (let matchIndex = 0; matchIndex < currentRound.length; matchIndex++) {
            const match = currentRound[matchIndex];
            
            // Skip if no next match
            if (!match.nextMatchId) continue;
            
            // Find the source and target match elements
            const sourceRef = matchRefs.current[`match-${match.id}`];
            const targetRef = matchRefs.current[`match-${match.nextMatchId}`];
            
            // Skip if either ref is missing
            if (!sourceRef || !targetRef) continue;
            
            // Get the source and target match positions
            const sourceRect = sourceRef.getBoundingClientRect();
            const targetRect = targetRef.getBoundingClientRect();
            
            // Calculate relative positions
            const x1 = (sourceRect.right - bracketRect.left) / scale;
            const y1 = (sourceRect.top + sourceRect.height / 2 - bracketRect.top) / scale;
            const x2 = (targetRect.left - bracketRect.left) / scale;
            const y2 = (targetRect.top + targetRect.height / 2 - bracketRect.top) / scale;
            
            // Create path for the connector line
            const midX = x1 + (x2 - x1) / 2;
            const path = `M${x1},${y1} H${midX} V${y2} H${x2}`;
            
            // Add the line to the array
            lines.push(
              <path 
                key={`connector-${match.id}-${match.nextMatchId}`}
                d={path}
                className={styles.connector}
                strokeWidth="2.5"
              />
            );
          }
        }
        
        setConnectorLines(lines);
      }, 100);
    };
    
    updateConnectorsAfterZoom();
    
  }, [zoomLevel, bracketData]);

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
        console.log('Debug - Event data team type:', eventData.team_type);
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
        
        if (data && data.bracket) {
          console.log('Debug - Bracket data received:', data.bracket);
          console.log('Debug - Participants data:', data.participants);
          
          // Check for duo members
          if (data.participants) {
            console.log('Debug - Checking for duo team members:');
            data.participants.forEach(participant => {
              console.log(`Participant: ${participant.name}, Has members:`, !!participant.members);
              if (participant.members && participant.members.length > 0) {
                console.log('  Members:', JSON.stringify(participant.members));
              }
            });
          }
          
          setBracketData(data.bracket);
          setParticipants(data.participants || []);
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
    if (!isAdmin) return;
    
    // Only allow selecting matches that have both participants and no winner yet
    if (match.participant1Id && match.participant2Id && !match.winnerId) {
      setSelectedMatch(match);
      setShowWinnerModal(true);
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

  // Get participant name by ID
  const getParticipantName = (participantId) => {
    if (!participantId) return 'TBD';
    const participant = participants.find(p => p.id === participantId);
    return participant ? participant.name : 'Unknown';
  };

  // Add a function to delete the bracket
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

  // Render bracket
  const renderBracket = () => {
    if (!bracketData || !Array.isArray(bracketData) || bracketData.length === 0) {
      return (
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
    }

    // Find if there's a winner
    let winner = null;
    const finalRound = bracketData[bracketData.length - 1];
    if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
      winner = participants.find(p => p.id === finalRound[0].winnerId);
    }

    // Check if this is a duo event
    const isDuoEvent = event?.team_type === 'duo';

    // Calculate spacing based on number of rounds
    const totalRounds = bracketData.length;

    const calculateRoundStyle = (roundIndex) => {
      // Lookup table with manually specified values for each tournament size
      const spacingTable = {
        // 8 teams (3 rounds)
        3: [
          // [gap, paddingTop, extraPairSpacing] for each round
          [20, 0, 0],     // Round 1: 4 matches
          [150, 55, 0],    // Round 2: 2 matches
          [0, 180, 0]      // Final: 1 match
        ],
        // 16 teams (4 rounds)
        4: [
          [20, 0, 0],     // Round 1: 8 matches
          [150, 55, 0],   // Round 2: 4 matches
          [400, 180, 0],   // Round 3: 2 matches
          [0, 450, 0]      // Final: 1 match
        ],
        // 32 teams (5 rounds)
        5: [
          [20, 0, 0],     // Round 1: 16 matches - no extra spacing between pairs
          [150, 55, 0],   // Round 2: 8 matches - no extra spacing between pairs
          [400, 180, 40], // Round 3: 4 matches - keep extra spacing
          [900, 450, 0],  // Round 4: 2 matches
          [0, 950, 0]     // Final: 1 match
        ],
        // 64 teams (6 rounds)
        6: [
          [20, 0, 0],      // Round 1: 32 matches
          [150, 55, 0],    // Round 2: 16 matches
          [400, 180, 40],   // Round 3: 8 matches
          [900, 450, 60],   // Round 4: 4 matches
          [1850, 950, 0],   // Round 5: 2 matches
          [0, 1900, 0]      // Final: 1 match
        ]
      };

      // Get values from the lookup table
      if (spacingTable[totalRounds] && spacingTable[totalRounds][roundIndex]) {
        const [gap, paddingTop, extraPairSpacing] = spacingTable[totalRounds][roundIndex];
        return {
          gap: `${gap}px`,
          paddingTop: `${paddingTop}px`,
          extraPairSpacing
        };
      }

      // Fallback values if tournament size is not in the lookup table
      return {
        gap: '20px',
        paddingTop: '0px',
        extraPairSpacing: 0
      };
    };

    // Function to determine if a match needs extra spacing (after every 2 matches)
    const needsExtraSpacing = (matchIndex) => {
      // Add extra spacing after every 2 matches (odd indices)
      return matchIndex % 2 === 1;
    };

    return (
      <div className={`${styles.bracketContainer} ${isFullscreen ? styles.fullscreen : ''}`}>
        {winner && (
          <div className={styles.winnerBanner}>
            <FaTrophy className={styles.trophyIcon} />
            <span>
              {isDuoEvent ? (
                <>
                  Champions: {winner.name}
                  {winner.members && winner.members.length > 0 && (
                    <span className={styles.winnerPartner}> & {winner.members[0]?.name}</span>
                  )}
                </>
              ) : (
                <>Champion: {winner.name}</>
              )}
            </span>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginBottom: '10px', color: '#FFD700', fontSize: '0.9rem' }}>
          <span>Click and drag to move the bracket • Use zoom controls to adjust size</span>
        </div>
        
        <div 
          className={styles.bracketScrollContainer} 
          ref={bracketScrollRef}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div 
            className={`${styles.bracketWrapper} ${!hasInteracted ? styles.bracketInitialPosition : ''}`} 
            style={{ 
              transform: `scale(${zoomLevel / 100})`,
              minWidth: `${Math.max(2000, bracketData.length * 500)}px`,
              minHeight: `${Math.max(2000, bracketData[0]?.length * 400)}px`,
              padding: '50px 200px 200px 50px'
            }}
            ref={bracketWrapperRef}
          >
            {/* SVG for connector lines */}
            <svg className={styles.connectorSvg}>
              {typeof window !== 'undefined' && connectorLines}
            </svg>
            
            {bracketData.map((round, roundIndex) => {
              const roundStyle = calculateRoundStyle(roundIndex);
              
              return (
                <div key={`round-${roundIndex}`} className={styles.round}>
                  <div className={styles.roundHeader}>
                    {roundIndex === 0 ? 'Round 1' : 
                     roundIndex === bracketData.length - 1 ? 'Final' : 
                     `Round ${roundIndex + 1}`}
                  </div>
                  <div className={styles.matches} style={{ gap: roundStyle.gap, paddingTop: roundStyle.paddingTop }}>
                    {round.map((match, matchIndex) => {
                      // Determine if match is ready to be played
                      const isMatchReady = !match.winnerId && 
                        match.participant1Id && match.participant2Id && 
                        match.participant1Name !== 'TBD' && match.participant2Name !== 'TBD' &&
                        match.participant1Name !== 'Bye' && match.participant2Name !== 'Bye';
                      
                      // Determine if this is the championship match
                      const isChampionshipMatch = roundIndex === bracketData.length - 1;
                      
                      // Calculate extra spacing for matches in rounds with 4+ matches
                      const extraSpacing = round.length >= 4 && needsExtraSpacing(matchIndex) && roundStyle.extraPairSpacing > 0 
                        ? { marginBottom: `${roundStyle.extraPairSpacing}px` } 
                        : {};
                      
                      // Find participant details for duo display
                      const participant1 = participants.find(p => p.id === match.participant1Id);
                      const participant2 = participants.find(p => p.id === match.participant2Id);
                      
                      // Check if this is a duo event
                      const isDuoEvent = event?.team_type === 'duo';
                      
                      // Debug logs for this specific match
                      if (isDuoEvent && (match.participant1Id || match.participant2Id)) {
                        console.log(`Debug - Match ${match.id} duo data:`);
                        console.log(`  Participant1: ${match.participant1Name}, ID: ${match.participant1Id}`);
                        console.log(`  Participant1 details:`, participant1);
                        if (participant1 && participant1.members) {
                          console.log(`  Participant1 members:`, participant1.members);
                          console.log(`  Participant1 partner name:`, participant1.members[0]?.name);
                        }
                        console.log(`  Participant2: ${match.participant2Name}, ID: ${match.participant2Id}`);
                        console.log(`  Participant2 details:`, participant2);
                        if (participant2 && participant2.members) {
                          console.log(`  Participant2 members:`, participant2.members);
                          console.log(`  Participant2 partner name:`, participant2.members[0]?.name);
                        }
                      }
                      
                      // Create variables for partner names with fallbacks
                      const participant1PartnerName = participant1 && participant1.members && participant1.members.length > 0
                        ? participant1.members[0].name
                        : '';
                        
                      const participant2PartnerName = participant2 && participant2.members && participant2.members.length > 0
                        ? participant2.members[0].name
                        : '';
                        
                      if (isDuoEvent) {
                        console.log(`Match ${match.id} partner names:`, {
                          participant1: match.participant1Name,
                          participant1Partner: participant1PartnerName,
                          participant2: match.participant2Name,
                          participant2Partner: participant2PartnerName
                        });
                      }
                      
                      return (
                        <div 
                          key={`match-${match.id}`} 
                          className={`${styles.match} ${match.winnerId ? styles.completed : ''} ${isMatchReady ? styles.ready : ''} ${selectedMatch?.id === match.id ? styles.selected : ''} ${isChampionshipMatch ? styles.championMatch : ''}`}
                          onClick={() => handleMatchClick(match)}
                          ref={el => matchRefs.current[`match-${match.id}`] = el}
                          style={extraSpacing}
                        >
                          <div className={styles.matchHeader}>
                            <span className={styles.matchId}>Match {match.id}</span>
                            {isMatchReady && <span className={styles.readyBadge}>Ready</span>}
                            {match.scheduledTime && (
                              <span className={styles.scheduledTime}>
                                <FaClock className={styles.scheduleIcon} /> {new Date(match.scheduledTime).toLocaleString([], {
                                  month: 'short', 
                                  day: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                            {match.location && (
                              <span className={styles.matchLocation}>
                                @ {match.location}
                              </span>
                            )}
                          </div>
                          <div className={`${styles.participant} ${match.winnerId === match.participant1Id ? styles.winner : ''}`}>
                            {isDuoEvent && participant1 && participant1.members && participant1.members.length > 0 ? (
                              <div className={styles.duoParticipant}>
                                <span className={styles.primaryName}>{match.participant1Name || 'TBD'}</span>
                                <span className={styles.duoSeparator}>with</span>
                                <span className={styles.partnerName}>{participant1PartnerName}</span>
                              </div>
                            ) : (
                              <span>{match.participant1Name || 'TBD'}</span>
                            )}
                          </div>
                          <div className={`${styles.participant} ${match.winnerId === match.participant2Id ? styles.winner : ''}`}>
                            {isDuoEvent && participant2 && participant2.members && participant2.members.length > 0 ? (
                              <div className={styles.duoParticipant}>
                                <span className={styles.primaryName}>{match.participant2Name || 'TBD'}</span>
                                <span className={styles.duoSeparator}>with</span>
                                <span className={styles.partnerName}>{participant2PartnerName}</span>
                              </div>
                            ) : (
                              <span>{match.participant2Name || 'TBD'}</span>
                            )}
                          </div>
                          {!match.winnerId && match.nextMatchId && (
                            <div className={styles.matchFooter}>
                              <span className={styles.advanceInfo}>
                                Winner advances to Match {match.nextMatchId}
                              </span>
                            </div>
                          )}
                          {match.winnerId && match.nextMatchId && (
                            <div className={styles.matchFooter}>
                              <span className={styles.advanceInfo}>
                                {isDuoEvent ? (
                                  <>
                                    {(() => {
                                      const winner = participants.find(p => p.id === match.winnerId);
                                      const winnerPartnerName = winner && winner.members && winner.members.length > 0
                                        ? winner.members[0].name
                                        : '';
                                        
                                      if (winner && winnerPartnerName) {
                                        return (
                                          <>
                                            {winner.name} & {winnerPartnerName}
                                          </>
                                        );
                                      }
                                      return winner?.name || 'Winner';
                                    })()}
                                  </>
                                ) : (
                                  participants.find(p => p.id === match.winnerId)?.name || 'Winner'
                                )} advanced to Match {match.nextMatchId}
                              </span>
                            </div>
                          )}
                          {match.notes && (
                            <div className={styles.matchNotes}>
                              <strong>Notes:</strong> {match.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className={styles.zoomControls}>
          <button className={styles.zoomButton} onClick={handleZoomOut} aria-label="Zoom out">
            <FaMinus />
          </button>
          <div className={styles.zoomLevel}>{zoomLevel}%</div>
          <button className={styles.zoomButton} onClick={handleZoomIn} aria-label="Zoom in">
            <FaPlus />
          </button>
          <button className={styles.zoomButton} onClick={handleResetZoom} aria-label="Reset zoom">
            <FaExpand />
          </button>
          <button className={styles.zoomButton} onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            {isFullscreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
        
        {isAdmin && (
          <div className={styles.adminActions}>
            <button 
              className={styles.deleteButton}
              onClick={handleDeleteBracket}
              disabled={loading}
            >
              Delete Tournament Bracket
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render winner selection modal
  const renderWinnerModal = () => {
    if (!showWinnerModal || !selectedMatch) return null;

    // Find participants with detailed info
    const participant1 = participants.find(p => p.id === selectedMatch.participant1Id);
    const participant2 = participants.find(p => p.id === selectedMatch.participant2Id);
    const isDuoEvent = event?.team_type === 'duo';

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h3>Select Winner</h3>
            <button 
              className={styles.closeButton}
              onClick={() => setShowWinnerModal(false)}
            >
              &times;
            </button>
          </div>
          <div className={styles.modalBody}>
            <p>Select the winner of this match:</p>
            <div className={styles.winnerOptions}>
              <button 
                className={styles.winnerOption}
                onClick={() => handleSetWinner(selectedMatch.participant1Id)}
              >
                {isDuoEvent && participant1 && participant1.members && participant1.members.length > 0 ? (
                  <>
                    <div>{selectedMatch.participant1Name}</div>
                    <small>with {participant1.members[0].name}</small>
                  </>
                ) : (
                  selectedMatch.participant1Name
                )}
              </button>
              <button 
                className={styles.winnerOption}
                onClick={() => handleSetWinner(selectedMatch.participant2Id)}
              >
                {isDuoEvent && participant2 && participant2.members && participant2.members.length > 0 ? (
                  <>
                    <div>{selectedMatch.participant2Name}</div>
                    <small>with {participant2.members[0].name}</small>
                  </>
                ) : (
                  selectedMatch.participant2Name
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render participants list
  const renderParticipants = () => {
    if (!participants || participants.length === 0) return null;

    return (
      <div className={styles.participantsSection}>
        <h3>
          <FaUsers className={styles.participantsIcon} />
          Participants ({participants.length})
        </h3>
        <div className={styles.participantsList}>
          {participants.map((participant, index) => (
            <div key={`participant-${participant.id}`} className={styles.participantItem}>
              <span className={styles.participantNumber}>{index + 1}</span>
              <div className={styles.participantInfo}>
                <span className={styles.participantName}>{participant.name}</span>
                {participant.members && participant.members.length > 0 && (
                  <div className={styles.teamMembers}>
                    {participant.members.map(member => (
                      <span key={`member-${member.id}`} className={styles.teamMember}>
                        {member.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Position the bracket at the top-left when it first loads
  useEffect(() => {
    if (bracketData && bracketScrollRef.current && !hasInteracted) {
      // Wait for the bracket to render
      setTimeout(() => {
        const scrollContainer = bracketScrollRef.current;
        if (!scrollContainer) return;
        
        // Scroll to top-left
        scrollContainer.scrollLeft = 0;
        scrollContainer.scrollTop = 0;
        
        console.log('Positioned bracket at top-left on initial load');
      }, 500); // Give time for the bracket to render
    }
  }, [bracketData, hasInteracted]);

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
            {renderBracket()}
            {renderParticipants()}
          </div>
        )}

        {renderWinnerModal()}
      </div>
    </ProtectedPageWrapper>
  );
} 