import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FaArrowLeft, FaTrophy, FaUsers, FaPlus, FaMinus, FaExpand, FaCompress } from 'react-icons/fa';
import styles from '../../../styles/Bracket.module.css';
import { useAuth } from '../../../contexts/AuthContext';
import ProtectedPageWrapper from '../../../components/ProtectedPageWrapper';

export default function EventBracket() {
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
    if (!id || !user) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get the session for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          throw new Error('Authentication token not available');
        }

        // Fetch event details
        const eventResponse = await fetch(`/api/events/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }

        const eventData = await eventResponse.json();
        setEvent(eventData.event);

        // Check if user is admin
        setIsAdmin(user.isAdmin);

        // Fetch bracket data
        try {
          const bracketResponse = await fetch(`/api/events/${id}/bracket`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            }
          });

          // If 404, it means no bracket exists yet
          if (bracketResponse.status === 404) {
            setBracketData(null);
            setParticipants([]);
            setLoading(false);
            return;
          }

          if (!bracketResponse.ok) {
            throw new Error(`Failed to fetch bracket data: ${bracketResponse.status}`);
          }

          const data = await bracketResponse.json();
          
          if (data && data.bracket) {
            setBracketData(data.bracket);
            setParticipants(data.participants || []);
          } else {
            setBracketData(null);
            setParticipants([]);
          }
        } catch (bracketError) {
          console.error('Error fetching bracket data:', bracketError);
          // Don't throw the error, just set bracket data to null
          setBracketData(null);
          setParticipants([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load tournament bracket');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, supabase]);

  // Generate bracket if admin
  const handleGenerateBracket = async () => {
    if (!isAdmin || !id) return;

    setLoading(true);
    setError(null);

    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication token not available');
      }

      // Generate bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error('Authentication token not available');
      }

      // Update match result
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication token not available');
      }
      
      // Delete bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
              Champion: {winner.name}
              {isDuoEvent && winner.members && winner.members.length > 0 && (
                <span className={styles.winnerPartner}> - {winner.members[0]?.name}</span>
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
                          </div>
                          <div className={`${styles.participant} ${match.winnerId === match.participant1Id ? styles.winner : ''}`}>
                            {isDuoEvent && participant1 && participant1.members && participant1.members.length > 0 ? (
                              <div className={styles.duoParticipant}>
                                <span className={styles.primaryName}>{match.participant1Name || 'TBD'}</span>
                                <span className={styles.duoSeparator}>-</span>
                                <span className={styles.partnerName}>{participant1.members[0]?.name || ''}</span>
                              </div>
                            ) : (
                              <span>{match.participant1Name || 'TBD'}</span>
                            )}
                          </div>
                          <div className={`${styles.participant} ${match.winnerId === match.participant2Id ? styles.winner : ''}`}>
                            {isDuoEvent && participant2 && participant2.members && participant2.members.length > 0 ? (
                              <div className={styles.duoParticipant}>
                                <span className={styles.primaryName}>{match.participant2Name || 'TBD'}</span>
                                <span className={styles.duoSeparator}>-</span>
                                <span className={styles.partnerName}>{participant2.members[0]?.name || ''}</span>
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
                                {participants.find(p => p.id === match.winnerId)?.name || 'Winner'} advanced to Match {match.nextMatchId}
                              </span>
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
                {selectedMatch.participant1Name}
              </button>
              <button 
                className={styles.winnerOption}
                onClick={() => handleSetWinner(selectedMatch.participant2Id)}
              >
                {selectedMatch.participant2Name}
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
      <div className={styles.container}>
        <Head>
          <title>{event ? event.title : 'Tournament'}</title>
          <meta name="description" content="Tournament bracket" />
        </Head>

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