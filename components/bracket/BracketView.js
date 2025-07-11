import { useState, useEffect, useRef } from 'react';
import { FaTrophy, FaPlus, FaMinus, FaExpand, FaCompress, FaClock } from 'react-icons/fa';
import styles from '../../styles/Bracket.module.css';
import ZoomControls from './ZoomControls';
import TournamentWinner from '../shared/TournamentWinner';
import { getParticipantNameById, getParticipantDisplayName } from '../../utils/participantUtils';

const BracketView = ({ 
  bracketData, 
  participants, 
  eventType, 
  isAdmin, 
  handleMatchClick, 
  tournamentChampion,
  handleDeleteBracket
}) => {
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
  const isDuoEvent = eventType === 'duo';
  const [disableMatchInteraction, setDisableMatchInteraction] = useState(true);

  // Enhance the effect that detects touch devices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if it's a touch device
      const isTouchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouchEnabled);
      
      // On touch devices, set a slightly higher initial zoom level for better visibility
      if (isTouchEnabled) {
        setZoomLevel(80); // Slightly zoomed out by default on mobile for better overview
        console.log("Mobile device detected, adjusting zoom");
        
        // Prevent default pinch-zoom behavior on the bracket
        const bracketContainer = document.querySelector(`.${styles.bracketScrollContainer}`);
        if (bracketContainer) {
          bracketContainer.addEventListener('touchmove', (e) => {
            // Prevent pinch-zoom if there are 2 or more touch points
            if (e.touches.length >= 2) {
              e.preventDefault();
            }
          }, { passive: false });
        }
      }
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

  const handleResetZoom = (customLevel) => {
    // Check if customLevel is a number, otherwise it might be an event object
    const zoomLevel = typeof customLevel === 'number' ? customLevel : 100;
    
    // Set the zoom level
    setZoomLevel(zoomLevel);
    setHasInteracted(false); // Reset the interaction state
    
    // Position the bracket at the top-left
    if (bracketScrollRef.current) {
      const scrollContainer = bracketScrollRef.current;
      scrollContainer.scrollLeft = 0;
      scrollContainer.scrollTop = 0;
    }
  };

  // Enhance the toggleFullscreen function with better mobile support
  const toggleFullscreen = () => {
    try {
      const container = document.querySelector(`.${styles.bracketContainer}`);
      if (!container) return;

      // Check if we're in fullscreen mode
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        // Try to enter fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) { // Safari & Opera
          container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) { // Firefox
          container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) { // IE/Edge
          container.msRequestFullscreen();
        } else {
          // Fallback for browsers without fullscreen API
          console.log("Fullscreen API not supported by this browser");
          // Toggle manual fullscreen class instead
          setIsFullscreen(true);
        }
      } else {
        // Try to exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { // Safari & Opera
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) { // Firefox
          document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) { // IE/Edge
          document.msExitFullscreen();
        } else {
          // Fallback for browsers without fullscreen API
          setIsFullscreen(false);
        }
      }
      
      // Force update the fullscreen state after a short delay
      setTimeout(() => {
        const isInFullscreen = !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        );
        setIsFullscreen(isInFullscreen);
        console.log("Fullscreen state updated:", isInFullscreen);
      }, 100);
    } catch (err) {
      console.error("Error toggling fullscreen:", err);
      // Fallback to manual fullscreen toggle
      setIsFullscreen(!isFullscreen);
    }
  };

  // Update the fullscreen change event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isInFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      
      setIsFullscreen(isInFullscreen);
      console.log("Fullscreen state changed:", isInFullscreen);
    };

    // Add event listeners for all browser variants
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      // Clean up event listeners
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
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
  }, [isDragging, startPos, scrollPos]);

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
    };
    
    // Debounce function to limit the frequency of updates
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
    
    // Create debounced version of the update function
    const debouncedUpdate = debounce(updateConnectorsAfterZoom, 10);
    
    // Call the update function immediately
    updateConnectorsAfterZoom();
    
    // Also set up a small delay to ensure lines are positioned correctly after any DOM updates
    setTimeout(updateConnectorsAfterZoom, 50);
    
  }, [zoomLevel, bracketData]);

  // Add wheel event listeners for zoom functionality
  useEffect(() => {
    const scrollContainer = bracketScrollRef.current;
    if (!scrollContainer || isTouchDevice) return;
    
    // Track if zoom operation is in progress to avoid conflicts
    let isZooming = false;
    
    const handleWheel = (e) => {
      // Only handle zoom if Ctrl key is pressed (standard zoom modifier)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // If already zooming, don't stack operations
        if (isZooming) return;
        isZooming = true;
        
        // Get current position of mouse relative to container
        const rect = scrollContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Get current scroll position
        const scrollLeft = scrollContainer.scrollLeft;
        const scrollTop = scrollContainer.scrollTop;
        
        // Calculate position within the content (adjust for scroll)
        const posX = mouseX + scrollLeft;
        const posY = mouseY + scrollTop;
        
        // Determine zoom direction based on wheel delta
        const delta = e.deltaY || e.detail || e.wheelDelta;
        
        // Current and new zoom levels
        const oldZoom = zoomLevel;
        let newZoom;
        
        if (delta > 0) {
          // Zoom out
          newZoom = Math.max(oldZoom - 5, 50);
        } else {
          // Zoom in
          newZoom = Math.min(oldZoom + 5, 200);
        }
        
        // Use requestAnimationFrame for smooth visual updates
        requestAnimationFrame(() => {
          // Set new zoom level
          setZoomLevel(newZoom);
          
          // Calculate new scroll position to keep the mouse point stable
          // Formula: newScroll = (mousePos / oldZoom) * newZoom - mouseScreenPos
          const scaleFactor = newZoom / oldZoom;
          
          // Use setTimeout to let the state update and rendering occur first
          setTimeout(() => {
            // Adjust scroll position to keep mouse position stable
            scrollContainer.scrollLeft = posX * scaleFactor - mouseX;
            scrollContainer.scrollTop = posY * scaleFactor - mouseY;
            
            // Reset zooming flag after a short delay
            setTimeout(() => {
              isZooming = false;
            }, 50);
          }, 10);
          
          // Mark as interacted to maintain this zoom/scroll state
          setHasInteracted(true);
        });
      }
    };
    
    // Add event listener with passive: false to allow preventDefault
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, [isTouchDevice, zoomLevel]);

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

  // Get full participant information including duo partner
  const getParticipantInfo = (participantId) => {
    if (!participantId) return null;
    return participants.find(p => p.id === participantId);
  };

  // Calculate spacing based on number of rounds
  const calculateRoundStyle = (roundIndex) => {
    const totalRounds = bracketData.length;
    
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
  
  if (!bracketData || !Array.isArray(bracketData) || bracketData.length === 0) {
    return null;
  }
  
  // Find if there's a winner
  let winner = tournamentChampion;
  if (!winner) {
    const finalRound = bracketData[bracketData.length - 1];
    if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
      winner = participants.find(p => p.id === finalRound[0].winnerId);
    }
  }

  // Handle match click for admin
  const handleMatchClickAdmin = (match) => {
    console.log("Match clicked:", match, "isAdmin:", isAdmin);
    
    if (!isAdmin) return;
    
    // Only allow selecting matches that have both participants and no winner yet
    if (match.participant1Id && match.participant2Id && !match.winnerId) {
      // Pass to parent component's handler instead of recursively calling itself
      handleMatchClick(match);
    }
  };

  // Sync overlay state when isAdmin changes
  useEffect(() => {
    setDisableMatchInteraction(!isAdmin);
  }, [isAdmin]);

  return (
    <div className={`${styles.bracketContainer} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Admin edit mode toggle */}
      {isAdmin && (
        <div className={styles.editModeContainer}>
          <button 
            className={styles.editModeToggle} 
            onClick={() => setDisableMatchInteraction(prev => !prev)}
          >
            {disableMatchInteraction ? 'Enable Editing' : 'Disable Editing'}
          </button>
        </div>
      )}

      {tournamentChampion && (
        <div className={styles.championsContainer}>
          <TournamentWinner
            winner={tournamentChampion}
            teamType={eventType}
            hideLink={true} // Hide the bracket link in this view
            className={styles.bracketWinner} // Apply bracket winner styling
          />
        </div>
      )}
      
      <div style={{ textAlign: 'center', marginBottom: '10px', color: '#FFD700', fontSize: '0.9rem' }}>
        <span>
          {isTouchDevice 
            ? "Drag to move the bracket • Use controls at the bottom to zoom and toggle fullscreen" 
            : "Click and drag to move the bracket • Use Ctrl+Scroll to zoom in/out • Use controls at the bottom to adjust size"}
        </span>
      </div>
      
      {/* Bracket scroll container */}
      <div 
        className={`${styles.bracketScrollContainer} ${disableMatchInteraction ? styles.disableInteractions : ''}`} 
        ref={bracketScrollRef}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div 
          className={`${styles.bracketWrapper} ${!hasInteracted ? styles.bracketInitialPosition : ''}`} 
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            minWidth: isTouchDevice ? `${Math.max(1200, bracketData.length * 300)}px` : `${Math.max(2000, bracketData.length * 500)}px`,
            minHeight: isTouchDevice ? `${Math.max(1500, bracketData[0]?.length * 300)}px` : `${Math.max(2000, bracketData[0]?.length * 400)}px`,
            padding: isTouchDevice ? '20px 100px 100px 20px' : '20px 100px',
            transition: 'transform 0.15s ease-out'
          }}
          ref={bracketWrapperRef}
        >
          {/* SVG for connector lines */}
          <svg 
            className={styles.connectorSvg}
            style={{
              transform: `scale(${1})`,
              transition: 'transform 0.15s ease-out'
            }}
          >
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
                    
                    // Get full participant info
                    const participant1 = getParticipantInfo(match.participant1Id);
                    const participant2 = getParticipantInfo(match.participant2Id);
                    
                    return (
                      <div 
                        key={`match-${match.id}`} 
                        className={`${styles.match} ${match.winnerId ? styles.completed : ''} ${isMatchReady ? styles.ready : ''} ${isChampionshipMatch ? styles.championMatch : ''} ${isTouchDevice ? styles.mobileMatch : ''}`}
                        onClick={() => handleMatchClickAdmin(match)}
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
                          {match.participant1Id ? 
                            getParticipantDisplayName(participant1, eventType, {
                              format: 'jsx',
                              className: styles.participantName,
                              styles: {
                                teamName: styles.teamName,
                                duoNames: styles.duoPlayerNames,
                                separator: styles.duoSeparator
                              }
                            }) : 
                            <span>{match.participant1Name || 'TBD'}</span>
                          }
                        </div>
                        <div className={`${styles.participant} ${match.winnerId === match.participant2Id ? styles.winner : ''}`}>
                          {match.participant2Id ? 
                            getParticipantDisplayName(participant2, eventType, {
                              format: 'jsx',
                              className: styles.participantName,
                              styles: {
                                teamName: styles.teamName,
                                duoNames: styles.duoPlayerNames,
                                separator: styles.duoSeparator
                              }
                            }) : 
                            <span>{match.participant2Name || 'TBD'}</span>
                          }
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
                              {getParticipantNameById(match.winnerId, participants, eventType, { format: 'text' })} advanced to Match {match.nextMatchId}
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
      
      {/* Fixed control bar at the bottom */}
      <div className={styles.bracketControlBar}>
        {!isTouchDevice ? (
          // Desktop controls
          <div className={styles.desktopControls}>
            <div className={styles.controlGroup}>
              <button 
                className={styles.controlButton} 
                onClick={handleZoomOut} 
                aria-label="Zoom out"
              >
                <FaMinus />
              </button>
              <div className={styles.zoomLevel}>{zoomLevel}%</div>
              <button 
                className={styles.controlButton} 
                onClick={handleZoomIn} 
                aria-label="Zoom in"
              >
                <FaPlus />
              </button>
            </div>
            
            <div className={styles.controlGroup}>
              <button 
                className={styles.controlButton} 
                onClick={handleResetZoom} 
                aria-label="Reset view"
              >
                <span style={{ fontSize: '12px' }}>Reset</span>
              </button>
              <button 
                className={styles.controlButton} 
                onClick={toggleFullscreen} 
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        ) : (
          // Mobile controls
          <div className={styles.mobileControls}>
            <button 
              className={styles.controlButton} 
              onClick={handleZoomOut} 
              aria-label="Zoom out"
            >
              <FaMinus />
            </button>
            <button 
              className={styles.controlButton} 
              onClick={handleZoomIn} 
              aria-label="Zoom in"
            >
              <FaPlus />
            </button>
            <button 
              className={styles.controlButton} 
              onClick={() => handleResetZoom(80)} 
              aria-label="Reset view"
            >
              <span style={{ fontSize: '12px' }}>Reset</span>
            </button>
            <button 
              className={styles.controlButton} 
              onClick={() => {
                try {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    const container = document.querySelector(`.${styles.bracketContainer}`);
                    if (container) container.requestFullscreen();
                  }
                  // Force update fullscreen state after a short delay
                  setTimeout(() => {
                    setIsFullscreen(!!document.fullscreenElement);
                  }, 100);
                } catch (err) {
                  console.error("Fullscreen error:", err);
                  setIsFullscreen(!isFullscreen);
                }
              }} 
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          </div>
        )}
      </div>
      
      {isAdmin && (
        <div className={styles.adminActions}>
          <button 
            className={styles.deleteButton}
            onClick={handleDeleteBracket}
          >
            Delete Tournament Bracket
          </button>
        </div>
      )}
    </div>
  );
};

export default BracketView; 