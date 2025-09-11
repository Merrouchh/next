import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { fetchActiveUserSessions, fetchUserBalance, fetchComputers } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import styles from '../styles/avcomputers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
// import { createClient as createServerClient } from '../utils/supabase/server-props'; // Removed unused import
// DynamicMeta removed - metadata now handled in _document.js
// import { MdChevronRight } from 'react-icons/md'; // Removed unused import
import UserLoginModal from '../components/UserLoginModal';

export const getServerSideProps = async ({ res }) => {
  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const computers = await fetchComputers();
    return {
      props: {
        computers,
        timestamp: Date.now() // Keep timestamp to force revalidation
      },
    };
  } catch (error) {
    console.error('Error fetching computers:', error);
    return {
      props: {
        computers: {
          normal: [],
          vip: []
        },
        timestamp: Date.now()
      },
    };
  }
};

// Computer component
const ComputerBox = ({ 
  computer, 
  isTopFloor, 
  lastUpdate, 
  highlightActive, 
  onOpenLoginModal, 
  isLoading, 
  userAlreadyLoggedIn, 
  userCurrentComputer 
}) => {
  // If component is in loading state, show a skeleton
  if (isLoading) {
    return (
      <div className={`${isTopFloor ? styles.vipPcBox : styles.pcSquare} ${styles.loadingComputer}`}>
        <div className={styles.loadingPulse}></div>
      </div>
    );
  }

  const timeParts = computer.timeLeft && computer.timeLeft !== 'No Time'
    ? computer.timeLeft.split(' : ') 
    : [0, 0];
  const hours = parseInt(timeParts[0]) || 0;
  const minutes = parseInt(timeParts[1]) || 0;
  const totalMinutes = hours * 60 + minutes;

  const boxClass = isTopFloor ? styles.vipPcBox : styles.pcSquare;
  const activeClass = computer.isActive
    ? totalMinutes < 60
      ? isTopFloor ? styles.orange : styles.warning
      : styles.active
    : styles.inactive;

  const lastUpdateTime = lastUpdate[computer.id];
  const isRecentlyUpdated = lastUpdateTime && Date.now() - lastUpdateTime < 1000;
  
  // Check if this is the computer the user is logged into
  const isUserCurrentComputer = userCurrentComputer && userCurrentComputer.hostId === computer.id;

  return (
    <div 
      key={computer.id} 
      className={`
        ${boxClass} 
        ${activeClass}
        ${isRecentlyUpdated ? styles.updated : ''}
        ${highlightActive && computer.isActive ? styles.highlight : ''}
        ${isUserCurrentComputer ? styles.userCurrentComputer : ''}
      `}
    >
      {isUserCurrentComputer && (
        <div className={styles.currentUserBadge}>Your Session</div>
      )}
      <div className={styles.pcNumber}>
        PC {computer.number}
      </div>
      <div className={styles.statusText}>
        {computer.isActive 
          ? `Active - Time Left: ${computer.timeLeft}` 
          : 'No User'}
      </div>
      
      {/* Show login button only for available computers and if user is not already logged in elsewhere */}
      {!computer.isActive && !userAlreadyLoggedIn && (
        <button 
          className={styles.loginButton}
          onClick={() => onOpenLoginModal({
            hostId: computer.id,
            type: isTopFloor ? 'Top' : 'Bottom',
            number: computer.number
          })}
        >
          Login
        </button>
      )}
    </div>
  );
};

// Top Computers section (Upper Floor)
const TopComputers = ({ 
  computers, 
  lastUpdate, 
  highlightActive, 
  onOpenLoginModal, 
  // isLoading, // Removed unused parameter
  userAlreadyLoggedIn,
  userCurrentComputer,
  isComputerLoaded
}) => {
  const vipContainerRef = useRef(null);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [currentPair, setCurrentPair] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [cachedPairWidth, setCachedPairWidth] = useState(0);

  const totalPairs = Math.ceil(computers.length / 2) - 1;

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cache the pair width to avoid repeated clientWidth access
  useEffect(() => {
    if (!isMobile || !vipContainerRef.current) return;
    
    const updatePairWidth = () => {
      if (vipContainerRef.current) {
        setCachedPairWidth(vipContainerRef.current.clientWidth);
      }
    };
    
    updatePairWidth();
    
    // Use ResizeObserver for better performance
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updatePairWidth);
      resizeObserver.observe(vipContainerRef.current);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', updatePairWidth);
    }
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updatePairWidth);
      }
    };
  }, [isMobile]);

  // Only run scroll handling on mobile
  const handleScroll = useCallback((e) => {
    if (!isMobile || !e.target || !cachedPairWidth) return;
    
    const container = e.target;
    const currentScrollPosition = container.scrollLeft;
    const currentPairIndex = Math.round(currentScrollPosition / cachedPairWidth);
    
    setCurrentPair(currentPairIndex);
    setIsAtStart(currentPairIndex === 0);
    setIsAtEnd(currentPairIndex === totalPairs);
  }, [isMobile, totalPairs, cachedPairWidth]);

  const handleScrollButton = useCallback((direction) => {
    if (!isMobile || !vipContainerRef.current || !cachedPairWidth) return;
    
    const container = vipContainerRef.current;
    
    const newPairIndex = direction === 'left' ? 
      Math.max(0, currentPair - 1) : 
      Math.min(totalPairs, currentPair + 1);
    
    container.scrollTo({
      left: newPairIndex * cachedPairWidth,
      behavior: 'smooth'
    });
    
    setCurrentPair(newPairIndex);
    setIsAtStart(newPairIndex === 0);
    setIsAtEnd(newPairIndex === totalPairs);
  }, [isMobile, currentPair, totalPairs, cachedPairWidth]);

  useEffect(() => {
    const container = vipContainerRef.current;
    if (!container || !isMobile) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, isMobile]);

  return (
    <div className={styles.vipWrapper}>
      <div className={styles.vipSection}>
        <h2 className={styles.sectionHeading}>Top Computers</h2>
        <div className={styles.swipeControls}>
          <button 
            onClick={() => handleScrollButton('left')} 
            className={`${styles.swipeButton} ${isAtStart ? styles.edgeDisabled : ''}`}
            disabled={isAtStart}
          >
            <span className={styles.swipeArrow}>←</span>
          </button>
          
          <button 
            onClick={() => handleScrollButton('right')} 
            className={`${styles.swipeButton} ${isAtEnd ? styles.edgeDisabled : ''}`}
            disabled={isAtEnd}
          >
            <span className={styles.swipeArrow}>→</span>
          </button>
        </div>

        <div 
          ref={vipContainerRef} 
          className={styles.vipComputers}
        >
          {computers.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isTopFloor={true}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
              onOpenLoginModal={onOpenLoginModal}
              isLoading={!isComputerLoaded(computer.id)}
              userAlreadyLoggedIn={userAlreadyLoggedIn}
              userCurrentComputer={userCurrentComputer}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Custom hook for queue management
const useQueueSystem = (user, supabase, modalSetters = {}) => {
  const { setErrorMessage, setShowErrorModal, setSuccessMessage, setShowSuccessModal, setConfirmMessage, setShowConfirmModal, setConfirmAction } = modalSetters;
  const [queueStatus, setQueueStatus] = useState({ 
    is_active: false, 
    allow_online_joining: true, // Default to true to show button initially
    current_queue_size: 0,
    automatic_mode: false 
  });
  const [userInQueue, setUserInQueue] = useState(null);
  const [isJoiningQueue, setIsJoiningQueue] = useState(false); // Prevent race conditions
  
  const fetchQueueStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        const status = data.status; // Status is now always an object due to API fix
        console.log('Queue status updated:', status); // Debug log
        
        // Ensure allow_online_joining is true unless explicitly set to false by admin
        const safeStatus = {
          ...status,
          allow_online_joining: status.allow_online_joining !== false // Default to true unless explicitly false
        };
        
        console.log('Button should be visible:', safeStatus.allow_online_joining && !userInQueue); // Debug log
        setQueueStatus(safeStatus);
        
        // Check if current user is in queue
        if (data.queue) {
          const userQueueEntry = data.queue.find(entry => entry.user_id === user.id);
          setUserInQueue(userQueueEntry || null);
        }
      } else {
        console.error('Failed to fetch queue status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching queue status:', error);
      // Don't immediately hide the button on error - keep current state
      // Only update if we don't have any status yet
      if (!queueStatus) {
        setQueueStatus({ 
          is_active: false, 
          allow_online_joining: true, // Keep button visible on error
          current_queue_size: 0,
          automatic_mode: false 
        });
      }
    }
  }, [user, queueStatus, userInQueue]);

  // Set up real-time subscriptions and polling
  useEffect(() => {
    if (!user || !supabase) return;
    
    fetchQueueStatus();
    
    // Set up real-time subscription for queue changes
    const queueSubscription = supabase
      .channel('queue-changes-users')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'computer_queue'
      }, (payload) => {
        console.log('Queue data changed:', payload);
        fetchQueueStatus();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_settings'
      }, (payload) => {
        console.log('Queue settings changed:', payload);
        fetchQueueStatus();
      })
      .subscribe();

    // More frequent polling for queue status to ensure sync - every 10 seconds
    const queueInterval = setInterval(fetchQueueStatus, 10000);
    
    return () => {
      queueSubscription.unsubscribe();
      clearInterval(queueInterval);
    };
  }, [user, supabase, fetchQueueStatus]);

  const joinQueue = async (computerType = 'any') => {
    // Prevent multiple simultaneous joins
    if (isJoiningQueue) {
      console.log('Already joining queue, preventing duplicate request');
      return false;
    }

    // Check if user is already in queue (immediate local check)
    if (userInQueue) {
      setErrorMessage('You are already in the queue!');
      setShowErrorModal(true);
      return false;
    }

    setIsJoiningQueue(true);
    
    try {
      // Properly await the session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setErrorMessage('Authentication required. Please log in again.');
        setShowErrorModal(true);
        return false;
      }

      const response = await fetch('/api/internal/queue-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'join',
          userId: user.id,
          queueData: { computerType }
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        // Immediately update local state to prevent duplicate joins
        setUserInQueue({ 
          position: result.position || 1, 
          computer_type: computerType,
          id: result.id 
        });
        setSuccessMessage('You have been added to the queue! We\'ll notify you when a computer becomes available.');
        setShowSuccessModal(true);
        return true;
      } else {
        setErrorMessage('Unable to join queue: ' + result.error);
        setShowErrorModal(true);
        return false;
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      setErrorMessage('Error joining queue');
      setShowErrorModal(true);
      return false;
    } finally {
      setIsJoiningQueue(false);
    }
  };

  const leaveQueue = async () => {
    if (!userInQueue) return;
    
    // Show custom confirmation modal instead of browser confirm
    setConfirmMessage('Are you sure you want to leave the queue?');
    setConfirmAction(() => performLeaveQueue);
    setShowConfirmModal(true);
  };

  const performLeaveQueue = async () => {
    setShowConfirmModal(false); // Close confirmation modal
    
    try {
      // Properly await the session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        setErrorMessage('Authentication required. Please log in again.');
        setShowErrorModal(true);
        return false;
      }

      const response = await fetch('/api/internal/queue-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'leave',
          userId: user.id
        })
      });

      if (response.ok) {
        setSuccessMessage('You have left the queue');
        setShowSuccessModal(true);
        return true;
      } else {
        const errorData = await response.json();
        setErrorMessage('Error leaving queue: ' + errorData.error);
        setShowErrorModal(true);
        return false;
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      setErrorMessage('Error leaving queue');
      setShowErrorModal(true);
      return false;
    }
  };

  return {
    queueStatus,
    userInQueue,
    fetchQueueStatus,
    joinQueue,
    leaveQueue,
    isJoiningQueue
  };
};

/**
 * AvailableComputers page component
 * 
 * This page allows users to:
 * 1. View the status of all computers (bottom floor and top floor)
 * 2. See which computers are available
 * 3. Log in to available computers using their own account
 *    - When a user clicks "Login" on an available computer, the system uses
 *      their own Gizmo ID (linked to their website account) to log them in
 *    - Users must have sufficient time balance to log in
 */
const AvailableComputers = () => {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageReady, setPageReady] = useState(true); // State for full page readiness - start as ready
  const [lastUpdate, setLastUpdate] = useState({});
  const prevComputers = useRef({ normal: [], vip: [] });
  const [highlightActive, setHighlightActive] = useState(false);
  // State for login modal
  const [loginModalState, setLoginModalState] = useState({
    isOpen: false,
    selectedComputer: null,
    autoLogin: null
  });
  // State to track if current user is already logged in
  const [userAlreadyLoggedIn, setUserAlreadyLoggedIn] = useState(false);
  // Store which computer the user is currently logged in to
  const [userCurrentComputer, setUserCurrentComputer] = useState(null);
  // Store user's gizmo_id for checking active sessions
  const [userGizmoId, setUserGizmoId] = useState(null);
  // Track which computers have loaded data
  const [loadedComputers, setLoadedComputers] = useState({});
  // Queue related states
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showQueueConfirmation, setShowQueueConfirmation] = useState(false);
  const [selectedQueueType, setSelectedQueueType] = useState(null);
  // Success/Error modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  // Move computersList to useMemo to prevent unnecessary recreations
  const computersList = useMemo(() => ({
    normal: [
      { number: 1, id: 26 }, { number: 2, id: 28 },
      { number: 3, id: 29 }, { number: 4, id: 31 },
      { number: 5, id: 27 }, { number: 6, id: 30 },
      { number: 7, id: 33 }, { number: 8, id: 32 }
    ],
    vip: [
      { number: 9, id: 21 }, { number: 10, id: 22 },
      { number: 11, id: 25 }, { number: 12, id: 20 },
      { number: 13, id: 24 }, { number: 14, id: 23 }
    ]
  }), []);

  // Fetch user's gizmo_id when they log in
  useEffect(() => {
    if (user?.id) {
      const fetchUserGizmoId = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('gizmo_id')
            .eq('id', user.id)
            .single();
            
          if (data && !error && data.gizmo_id) {
            setUserGizmoId(data.gizmo_id);
          }
        } catch (err) {
          console.error("Error fetching user's gizmo_id:", err);
        }
      };
      
      fetchUserGizmoId();
    }
  }, [user, supabase]);

  // Queue management
  const { queueStatus, userInQueue, fetchQueueStatus, joinQueue, leaveQueue, isJoiningQueue } = useQueueSystem(user, supabase, {
    setErrorMessage,
    setShowErrorModal,
    setSuccessMessage,
    setShowSuccessModal,
    setConfirmMessage,
    setShowConfirmModal,
    setConfirmAction
  });

  // Handle queue type selection - show confirmation modal
  const handleQueueSelection = (queueType) => {
    // Prevent selection if already joining
    if (isJoiningQueue) return;
    
    setSelectedQueueType(queueType);
    setShowQueueModal(false);
    setShowQueueConfirmation(true);
  };

  // Handle final queue confirmation
  const handleQueueConfirmation = async () => {
    const success = await joinQueue(selectedQueueType);
    if (success) {
      setShowQueueConfirmation(false);
      setSelectedQueueType(null);
      // Refresh queue status to get updated data
      fetchQueueStatus();
    }
  };



  const updateSingleComputer = useCallback((computer, newData) => {
    setComputers(prev => {
      const section = computer.number <= 8 ? 'normal' : 'vip';
      const newComputers = {
        ...prev,
        [section]: prev[section].map(pc => 
          pc.id === computer.id ? { ...pc, ...newData } : pc
        )
      };
      return newComputers;
    });

    // Mark this computer as loaded
    setLoadedComputers(prev => ({
      ...prev,
      [computer.id]: true
    }));
  }, []);

  // Optimize data fetching
  useEffect(() => {
    let mounted = true;
    let intervalId;

    const fetchComputerStatus = async (computer) => {
      try {
        const activeSessions = await fetchActiveUserSessions();
        const session = activeSessions.find(s => s.hostId === computer.id);
        
        if (!mounted) return;

        const currentStatus = {
          isActive: false,
          timeLeft: 'No Time',
          userId: null
        };

        if (session) {
          currentStatus.isActive = true;
          currentStatus.userId = session.userId;
          const balance = await fetchUserBalance(session.userId);
          currentStatus.timeLeft = typeof balance === 'string' ? balance : balance.balance || 'No Time';
        }

        updateSingleComputer(computer, currentStatus);
        setLastUpdate(prev => ({ ...prev, [computer.id]: Date.now() }));
        
        const section = computer.number <= 8 ? 'normal' : 'vip';
        prevComputers.current[section] = prevComputers.current[section].map(pc =>
          pc.id === computer.id ? { ...pc, ...currentStatus } : pc
        );

        // Check if current user is logged in to any computer
        if (userGizmoId) {
          const userSession = activeSessions.find(s => s.userId === userGizmoId);
          if (userSession) {
            setUserAlreadyLoggedIn(true);
            
            // Find the computer details for the session
            const userComputer = computersList.normal.find(c => c.id === userSession.hostId) || 
                                computersList.vip.find(c => c.id === userSession.hostId);
            
            if (userComputer) {
              const computerType = userComputer.number <= 8 ? 'Bottom' : 'Top';
              setUserCurrentComputer({
                type: computerType,
                number: userComputer.number,
                hostId: userSession.hostId
              });
            }
          } else {
            setUserAlreadyLoggedIn(false);
            setUserCurrentComputer(null);
          }
        }

      } catch (error) {
        console.error(`Error updating computer ${computer.number}:`, error);
        // Even if there's an error, mark as loaded to prevent endless loading state
        setLoadedComputers(prev => ({
          ...prev,
          [computer.id]: true
        }));
      }
    };

    const fetchAllComputers = async () => {
      if (!user) return;  // Simplified check

      try {
        await Promise.all([
          ...computersList.normal,
          ...computersList.vip
        ].map(computer => fetchComputerStatus(computer)));

        if (mounted) setError(null);
      } catch (err) {
        console.error('Error fetching computer data:', err);
        if (mounted) setError('Unable to fetch computer data. Please try again.');
        
        // Mark all computers as loaded even on error to prevent infinite loading
        const allLoaded = {};
        [...computersList.normal, ...computersList.vip].forEach(computer => {
          allLoaded[computer.id] = true;
        });
        setLoadedComputers(allLoaded);
      }
    };

    if (user) {  // Simplified check
      fetchAllComputers();
      intervalId = setInterval(fetchAllComputers, 5000);
    }

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, updateSingleComputer, computersList, userGizmoId]);

  // Initialize computers state
  useEffect(() => {
    if (!computers.normal.length && !computers.vip.length) {
      const initialComputers = {
        normal: computersList.normal.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' })),
        vip: computersList.vip.map(pc => ({ ...pc, isActive: false, timeLeft: 'No Time' }))
      };
      setComputers(initialComputers);
      prevComputers.current = initialComputers;
      
      // Set loading to false immediately
      setIsLoading(false);
      setPageReady(true);
    }
  }, [computersList, computers.normal.length, computers.vip.length]);

  // Add effect to handle highlighting
  useEffect(() => {
    if (router.query.from === 'dashboard') {
      setHighlightActive(true);
      setTimeout(() => setHighlightActive(false), 2000); // Remove highlight after 2 seconds
    }
  }, [router.query]);

  // Handle open login modal
  const handleOpenLoginModal = async (computer) => {
    // Don't allow login if user is already logged in elsewhere
    if (userAlreadyLoggedIn) {
      alert("You are already logged in to another computer");
      return;
    }
    
    // Check if user is authenticated
    if (!user || !user.id) {
      alert("You must be logged in to use this feature");
      return;
    }

    // Check if queue is active
    if (queueStatus && queueStatus.is_active) {
      // If user is in queue
      if (userInQueue) {
        // NEW LOGIC: Check if user is #1 in their specific queue type
        const canLoginToThisComputer = await checkQueueEligibility(computer, userInQueue);
        
        if (canLoginToThisComputer) {
          // User is eligible - continue with normal login process
          console.log(`User is #1 in ${userInQueue.computer_type} queue and can login to ${computer.type} computer`);
        } else {
          // User must wait - not eligible for this computer type
          const computerType = computer.type.toLowerCase();
          const computerTypeLabel = computerType === 'top' ? 'top floor' : 'bottom floor';
          const breakdown = await getQueueBreakdownBeforeUser(userInQueue);
          
          let message = `You are #${breakdown.position} for ${computerTypeLabel} computers.`;
          
          // Add breakdown of who's ahead
          const ahead = [];
          if (breakdown.anyAhead > 0) ahead.push(`${breakdown.anyAhead} any`);
          if (breakdown.bottomAhead > 0) ahead.push(`${breakdown.bottomAhead} bottom`);
          if (breakdown.topAhead > 0) ahead.push(`${breakdown.topAhead} top`);
          
          if (ahead.length > 0) {
            message += ` ${ahead.join(', ')} ahead of you.`;
          }
          
          alert(message);
          return;
        }
      } else {
        // If queue is active but user not in queue, prompt to join
        if (queueStatus.allow_online_joining) {
          setShowQueueModal(true);
          return;
        } else {
          alert("A queue is currently active and online joining is disabled. Please visit the gaming center to join the physical queue.");
          return;
        }
      }
    }
    
    try {
      // Get the user's profile from Supabase to find their gizmo_id
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('gizmo_id, username')
        .eq('id', user.id)
        .single();
      
      if (error || !userProfile) {
        console.error("Error fetching user profile:", error);
        alert("Could not find your user profile. Please contact support.");
        return;
      }
      
      if (!userProfile.gizmo_id) {
        alert("Your account doesn't have a gaming user ID associated with it. Please visit the gaming center to connect your accounts.");
        return;
      }
      
      // Open the modal with the user's info for auto-login
      setLoginModalState({
        isOpen: true,
        selectedComputer: computer,
        autoLogin: {
          gizmoId: userProfile.gizmo_id,
          username: userProfile.username || `User ${userProfile.gizmo_id}`
        }
      });
    } catch (error) {
      console.error("Error preparing login:", error);
      alert("An error occurred. Please try again.");
    }
  };

  // Helper function to check if user can login to specific computer based on queue type
  const checkQueueEligibility = async (computer, userQueueEntry) => {
    const computerType = computer.type.toLowerCase(); // 'top' or 'bottom'
    const userQueueType = userQueueEntry.computer_type; // 'any', 'bottom', 'top'
    
    // Check if computer type matches user's queue preference
    if (userQueueType === 'bottom' && computerType === 'top') {
      return false; // Bottom queue user can't login to top computer
    }
    if (userQueueType === 'top' && computerType !== 'top') {
      return false; // Top queue user can't login to bottom computer  
    }
    
    // Get user's position among ALL people who could take this computer type
    // For bottom computers: check among "any" + "bottom" queues
    // For top computers: check among "any" + "top" queues
    const eligibleQueueTypes = computerType === 'top' 
      ? ['any', 'top'] 
      : ['any', 'bottom'];
    
    const positionAmongEligible = await getUserPositionAmongEligibleQueues(eligibleQueueTypes);
    return positionAmongEligible === 1;
  };

  // Helper function to get user's position within their specific queue type - UNUSED
  /*
  const getUserPositionInQueueType = async (queueType) => {
    try {
      const { data: queueEntries, error } = await supabase
        .from('computer_queue')
        .select('user_id, position')
        .eq('computer_type', queueType)
        .eq('status', 'waiting')
        .order('position');
      
      if (error || !queueEntries) {
        console.error('Error fetching queue entries:', error);
        return 999; // Return high number to prevent login
      }
      
      // Find user's position within this queue type (1-indexed)
      const userIndex = queueEntries.findIndex(entry => entry.user_id === user.id);
      return userIndex === -1 ? 999 : userIndex + 1;
    } catch (error) {
      console.error('Error calculating queue position:', error);
      return 999;
    }
  };
  */

  // Helper function to get user's position among all people eligible for a computer type
  const getUserPositionAmongEligibleQueues = async (eligibleQueueTypes) => {
    try {
      const { data: queueEntries, error } = await supabase
        .from('computer_queue')
        .select('user_id, position, computer_type')
        .in('computer_type', eligibleQueueTypes)
        .eq('status', 'waiting')
        .order('position'); // Order by global position to maintain FIFO fairness
      
      if (error || !queueEntries) {
        console.error('Error fetching eligible queue entries:', error);
        return 999; // Return high number to prevent login
      }
      
      // Find user's position among all eligible people (1-indexed)
      const userIndex = queueEntries.findIndex(entry => entry.user_id === user.id);
      return userIndex === -1 ? 999 : userIndex + 1;
    } catch (error) {
      console.error('Error calculating position among eligible queues:', error);
      return 999;
    }
  };

  // Cache for queue breakdown to prevent unnecessary API calls
  const queueBreakdownCache = useRef(new Map());
  const queueBreakdownCacheTime = useRef(new Map());

  // Helper function to get breakdown of who's ahead of the user (with caching)
  const getQueueBreakdownBeforeUser = useCallback(async (userQueueEntry) => {
    // Use stable values for cache key, not object properties that might change reference
    const userId = userQueueEntry.user_id || userQueueEntry.id;
    const userPos = userQueueEntry.position;
    const compType = userQueueEntry.computer_type;
    const cacheKey = `${userId}-${userPos}-${compType}`;
    const now = Date.now();
    
    // Check if we have cached data that's less than 12 seconds old (longer cache)
    if (queueBreakdownCache.current.has(cacheKey)) {
      const cacheTime = queueBreakdownCacheTime.current.get(cacheKey) || 0;
      if (now - cacheTime < 12000) { // 12 seconds cache to span multiple polling intervals
        return queueBreakdownCache.current.get(cacheKey);
      }
    }

    try {
      // Get all queue entries that could compete with this user
      let eligibleQueueTypes = [];
      
      if (userQueueEntry.computer_type === 'any') {
        eligibleQueueTypes = ['any', 'bottom', 'top']; // Any queue competes with everyone
      } else if (userQueueEntry.computer_type === 'bottom') {
        eligibleQueueTypes = ['any', 'bottom']; // Bottom competes with any + bottom
      } else if (userQueueEntry.computer_type === 'top') {
        eligibleQueueTypes = ['any', 'top']; // Top competes with any + top
      }

      const { data: queueEntries, error } = await supabase
        .from('computer_queue')
        .select('user_id, position, computer_type')
        .in('computer_type', eligibleQueueTypes)
        .eq('status', 'waiting')
        .order('position');
      
      if (error || !queueEntries) {
        console.error('Error fetching queue breakdown:', error);
        return { position: 999, anyAhead: 0, bottomAhead: 0, topAhead: 0 };
      }
      
      // Find user's position among eligible people
      const userIndex = queueEntries.findIndex(entry => entry.user_id === user.id);
      if (userIndex === -1) {
        return { position: 999, anyAhead: 0, bottomAhead: 0, topAhead: 0 };
      }
      
      // Count people ahead of the user by queue type
      const peopleAhead = queueEntries.slice(0, userIndex);
      const breakdown = {
        position: userIndex + 1,
        anyAhead: peopleAhead.filter(entry => entry.computer_type === 'any').length,
        bottomAhead: peopleAhead.filter(entry => entry.computer_type === 'bottom').length,
        topAhead: peopleAhead.filter(entry => entry.computer_type === 'top').length
      };
      
      // Cache the result
      queueBreakdownCache.current.set(cacheKey, breakdown);
      queueBreakdownCacheTime.current.set(cacheKey, now);
      
      return breakdown;
    } catch (error) {
      console.error('Error getting queue breakdown:', error);
      return { position: 999, anyAhead: 0, bottomAhead: 0, topAhead: 0 };
    }
  }, [user?.id, supabase]);

  // Clear queue breakdown cache only when queue counts actually change significantly
  const previousQueueCounts = useRef({});
  useEffect(() => {
    const currentCounts = {
      total: queueStatus?.current_queue_size || 0,
      any: queueStatus?.any_queue_count || 0,
      bottom: queueStatus?.bottom_queue_count || 0,
      top: queueStatus?.top_queue_count || 0
    };

    // Only clear cache if counts actually changed, not just object reference
    const countsChanged = Object.keys(currentCounts).some(
      key => currentCounts[key] !== previousQueueCounts.current[key]
    );

    if (countsChanged && queueBreakdownCache.current) {
      // Delay cache clear to let pending requests complete
      const timeoutId = setTimeout(() => {
        queueBreakdownCache.current.clear();
        queueBreakdownCacheTime.current.clear();
        console.log('Queue cache cleared due to count changes');
      }, 2000);

      previousQueueCounts.current = currentCounts;
      return () => clearTimeout(timeoutId);
    }

    previousQueueCounts.current = currentCounts;
  }, [queueStatus?.current_queue_size, queueStatus?.any_queue_count, queueStatus?.bottom_queue_count, queueStatus?.top_queue_count]);

  // Handle close login modal
  const handleCloseLoginModal = () => {
    setLoginModalState({
      isOpen: false,
      selectedComputer: null,
      autoLogin: null
    });
  };

  // Handle login success
  const handleLoginSuccess = async (user, computer) => {
    console.log(`User ${user.username} (ID: ${user.gizmoId}) logged in to ${computer.type} ${computer.number} (Host ID: ${computer.hostId})`);
    
    // Update UI to show the computer is now in use
    const computerType = computer.type.toLowerCase();
    const computerSection = computerType === 'top' ? 'vip' : 'normal';
    
    // Mark the computer as being updated
    setLastUpdate(prev => ({ ...prev, [computer.hostId]: Date.now() }));
    
    // Set user as logged in immediately and track which computer
    setUserAlreadyLoggedIn(true);
    setUserCurrentComputer(computer);
    
    // Automatically remove user from queue if they were in it
    try {
      // Find user in queue by gizmo_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username')
        .eq('gizmo_id', user.gizmoId)
        .single();

      if (!userError && userData) {
        // Check if user is in queue
        const { data: queueEntry, error: queueError } = await supabase
          .from('computer_queue')
          .select('id, user_name, position')
          .eq('user_id', userData.id)
          .eq('status', 'waiting')
          .single();

        if (!queueError && queueEntry) {
          // Remove user from queue
          const { error: deleteError } = await supabase
            .from('computer_queue')
            .delete()
            .eq('id', queueEntry.id);

          if (!deleteError) {
            console.log(`✅ Automatically removed ${userData.username} from queue (position ${queueEntry.position}) - logged into ${computer.type} floor computer ${computer.number}`);
          } else {
            console.error('❌ Failed to remove user from queue:', deleteError);
          }
        }
      }
    } catch (error) {
      console.error('Error removing user from queue after login:', error);
    }
    
    // Delay the refetch to give the server time to update
    setTimeout(() => {
      const refreshData = async () => {
        try {
          const activeSessions = await fetchActiveUserSessions();
          const session = activeSessions.find(s => s.hostId === computer.hostId);
          
          if (session) {
            const balance = await fetchUserBalance(session.userId);
            
            // Update the specific computer
            setComputers(prev => {
              const updatedComputers = {
                ...prev,
                [computerSection]: prev[computerSection].map(pc => 
                  pc.id === computer.hostId ? {
                    ...pc,
                    isActive: true,
                    userId: session.userId,
                    timeLeft: balance || 'No Time'
                  } : pc
                )
              };
              return updatedComputers;
            });
          }
        } catch (error) {
          console.error(`Error updating computer status after login:`, error);
        }
      };
      
      refreshData();
    }, 2000);
  };

  // Check if a specific computer has loaded data
  const isComputerLoaded = useCallback((computerId) => {
    return loadedComputers[computerId] === true;
  }, [loadedComputers]);

  // Simple component to display user's position in their specific queue type
  const QueuePositionDisplay = ({ userInQueue }) => {
    if (!userInQueue) return null;
    
    const userPosition = userInQueue?.position;
    const userComputerType = userInQueue?.computer_type;
    
    const queueTypeLabel = userComputerType === 'any' ? 'any computer' 
      : userComputerType === 'bottom' ? 'bottom floor computers' 
      : 'top floor computers';

    const displayText = `Position ${userPosition} for ${queueTypeLabel}`;
    
    return (
      <span className={styles.positionText}>
        {displayText}
      </span>
    );
  };

  // Check occupancy status for different computer types
  const computerOccupancy = useMemo(() => {
    const bottomOccupied = computers.normal.filter(computer => computer.isActive).length;
    const topOccupied = computers.vip.filter(computer => computer.isActive).length;
    const totalOccupied = bottomOccupied + topOccupied;
    
    return {
      bottom: {
        occupied: bottomOccupied,
        total: 8,
        isFull: bottomOccupied === 8
      },
      top: {
        occupied: topOccupied,
        total: 6,
        isFull: topOccupied === 6
      },
      all: {
        occupied: totalOccupied,
        total: 14,
        isFull: totalOccupied === 14
      }
    };
  }, [computers.normal, computers.vip]);



  // Page is always ready now - no loading screen needed

  // Only show the error screen if there's an error and the page is ready
  if (error && pageReady) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.error}>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </ProtectedPageWrapper>
    );
  }

  return (
    <>
      <Head>
        <title>Available Gaming PCs | Real-time Status | Merrouch Gaming</title>
      </Head>
      <ProtectedPageWrapper>
              {/* DynamicMeta removed - metadata now handled in _document.js */}
        <main className={styles.mainContainer}>
        <div className={styles.liveIndicator}>
          <div className={styles.liveDot}></div>
          <span className={styles.liveText}>Live</span>
        </div>


        {/* Compact Queue Status Display with Breakdown */}
        {queueStatus && (queueStatus.is_active || queueStatus.current_queue_size > 0) && (
          <div className={styles.compactQueueStatus}>
            <div className={styles.queueHeader}>
              <h3>🎮 Queue Active ({queueStatus.current_queue_size} waiting)</h3>
              {queueStatus.allow_online_joining && !userInQueue && !userAlreadyLoggedIn && (
                <button 
                  className={styles.compactJoinButton} 
                  onClick={() => setShowQueueModal(true)}
                  disabled={isJoiningQueue}
                >
                  {isJoiningQueue ? 'Joining...' : 'Join'}
                </button>
              )}
            </div>

            {/* Queue Breakdown by Computer Type */}
            <div className={styles.queueBreakdown}>
              <div className={styles.queueType}>
                <span className={styles.queueIcon}>🎮</span>
                <span className={styles.queueLabel}>Any Computer</span>
                <span className={styles.queueCount}>{queueStatus.any_queue_count || 0}</span>
              </div>
              <div className={styles.queueType}>
                <span className={styles.queueIcon}>⬇️</span>
                <span className={styles.queueLabel}>Bottom Only</span>
                <span className={styles.queueCount}>{queueStatus.bottom_queue_count || 0}</span>
              </div>
              <div className={styles.queueType}>
                <span className={styles.queueIcon}>⬆️</span>
                <span className={styles.queueLabel}>Top Only</span>
                <span className={styles.queueCount}>{queueStatus.top_queue_count || 0}</span>
              </div>
            </div>

            {/* User's Position if in Queue */}
            {userInQueue && (
              <div className={styles.userQueuePosition}>
                <QueuePositionDisplay 
                  userInQueue={userInQueue}
                />
                <button className={styles.compactLeaveButton} onClick={leaveQueue}>
                  Leave
                </button>
              </div>
            )}
          </div>
        )}

        {/* Simple Join Queue Button */}
        {!userInQueue && !userAlreadyLoggedIn && (
          <div className={styles.simpleQueueSection}>
            <button 
              className={styles.simpleJoinButton} 
              onClick={() => setShowQueueModal(true)}
              disabled={isJoiningQueue}
            >
              {isJoiningQueue ? 'Joining...' : 'Join Queue'}
            </button>
          </div>
        )}




        
        <h2 className={styles.sectionHeading}>Bottom Computers</h2>
        <div className={styles.computerGrid}>
          {computers.normal.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isTopFloor={false}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
              onOpenLoginModal={handleOpenLoginModal}
              isLoading={!isComputerLoaded(computer.id)}
              userAlreadyLoggedIn={userAlreadyLoggedIn}
              userCurrentComputer={userCurrentComputer}
            />
          ))}
        </div>

        <TopComputers 
          computers={computers.vip} 
          lastUpdate={lastUpdate}
          highlightActive={highlightActive}
          onOpenLoginModal={handleOpenLoginModal}
          isLoading={isLoading}
          userAlreadyLoggedIn={userAlreadyLoggedIn}
          userCurrentComputer={userCurrentComputer}
          isComputerLoaded={isComputerLoaded}
        />
        
        {/* User confirmation login modal */}
        <UserLoginModal 
          isOpen={loginModalState.isOpen}
          onClose={handleCloseLoginModal}
          selectedComputer={loginModalState.selectedComputer}
          onSuccess={handleLoginSuccess}
          autoLoginUser={loginModalState.autoLogin}
        />

        {/* Queue Join Modal */}
        {showQueueModal && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <h3>Choose Your Queue Preference</h3>
              <p>
                Choose your preferred computer floor below. You can join a queue for any floor even if some computers are currently available.
              </p>
              
                              <div className={styles.queueModalOptions}>
                  <h4>Computer Preference:</h4>
                  <div className={styles.preferenceButtons}>
                    {/* Any Computer Option - Always show, best when all are full */}
                    <button 
                      className={`${styles.preferenceButton} ${computerOccupancy.all.isFull ? '' : styles.lessPreferred}`}
                      onClick={() => handleQueueSelection('any')}
                      disabled={isJoiningQueue}
                    >
                      <div className={styles.preferenceTitle}>🎮 Any Available Computer</div>
                      <div className={styles.preferenceSubtitle}>
                        Get the next available computer from any floor
                        {computerOccupancy.all.isFull ? ' (fastest option)' : ' (when all floors are full)'}
                      </div>
                                             <div className={styles.estimatedWait}>
                         {computerOccupancy.all.isFull 
                           ? `~${Math.max(5, (queueStatus?.any_queue_count || 0) * 3)} min wait (${queueStatus?.any_queue_count || 0} ahead)`
                           : 'Will wait for any floor to have availability'
                         }
                       </div>
                    </button>
                    
                    {/* Bottom Floor Option - Always show */}
                    <button 
                      className={`${styles.preferenceButton} ${!computerOccupancy.bottom.isFull ? styles.availableOption : ''}`}
                      onClick={() => handleQueueSelection('bottom')}
                      disabled={isJoiningQueue}
                    >
                      <div className={styles.preferenceTitle}>
                        ⬇️ Bottom Floor Only 
                        {!computerOccupancy.bottom.isFull && (
                          <span className={styles.availableBadge}>({8 - computerOccupancy.bottom.occupied} available now!)</span>
                        )}
                      </div>
                      <div className={styles.preferenceSubtitle}>
                        Bottom floor gaming PCs only (PC 1-8)
                        {computerOccupancy.bottom.isFull ? ' - Currently Full' : ' - Some Available!'}
                      </div>
                                             <div className={styles.estimatedWait}>
                         {computerOccupancy.bottom.isFull 
                           ? `~${Math.max(10, (queueStatus?.bottom_queue_count || 0) * 7)} min wait (${queueStatus?.bottom_queue_count || 0} ahead)`
                           : 'Available now - Try login directly or join queue!'
                         }
                       </div>
                    </button>
                    
                    {/* Top Floor Option - Always show */}
                    <button 
                      className={`${styles.preferenceButton} ${!computerOccupancy.top.isFull ? styles.availableOption : ''}`}
                      onClick={() => handleQueueSelection('top')}
                      disabled={isJoiningQueue}
                    >
                      <div className={styles.preferenceTitle}>
                        ⬆️ Top Floor Only 
                        {!computerOccupancy.top.isFull && (
                          <span className={styles.availableBadge}>({6 - computerOccupancy.top.occupied} available now!)</span>
                        )}
                      </div>
                      <div className={styles.preferenceSubtitle}>
                        Top floor gaming PCs only (PC 9-14)
                        {computerOccupancy.top.isFull ? ' - Currently Full' : ' - Some Available!'}
                      </div>
                                             <div className={styles.estimatedWait}>
                         {computerOccupancy.top.isFull 
                           ? `~${Math.max(15, (queueStatus?.top_queue_count || 0) * 10)} min wait (${queueStatus?.top_queue_count || 0} ahead)`
                           : 'Available now - Try login directly or join queue!'  
                         }
                       </div>
                    </button>
                  </div>
                </div>

              <div className={styles.queueModalActions}>
                <button 
                  className={styles.queueCancelButton}
                  onClick={() => setShowQueueModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Queue Confirmation Modal */}
        {showQueueConfirmation && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <h3>🎮 Join Queue Confirmation</h3>
              <div className={styles.confirmationMessage}>
                <p>
                  <strong>You&apos;re about to join the queue for {
                    selectedQueueType === 'any' ? 'any available computer' :
                    selectedQueueType === 'bottom' ? 'bottom floor computers' :
                    'top floor computers'
                  }.</strong>
                </p>
                
                <div className={styles.confirmationInfo}>
                  <p>📋 <strong>What happens next:</strong></p>
                  <ul>
                    <li>✅ You&apos;ll be added to the waiting list</li>
                    <li>🔔 We&apos;ll notify you when it&apos;s your turn</li>
                    <li>🎮 <strong>We will automatically log you in</strong> when a computer becomes available</li>
                    <li>❌ If you change your mind, you can remove yourself from the queue</li>
                  </ul>
                </div>

                <div className={styles.importantNote}>
                  <p>⚠️ <strong>Important:</strong> Make sure you&apos;re ready to start gaming when it&apos;s your turn!</p>
                </div>
              </div>

              <div className={styles.queueModalActions}>
                <button 
                  className={styles.queueCancelButton}
                  onClick={() => {
                    setShowQueueConfirmation(false);
                    setSelectedQueueType(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className={styles.queueConfirmButton}
                  onClick={handleQueueConfirmation}
                  disabled={isJoiningQueue}
                >
                  {isJoiningQueue ? 'Joining...' : 'Confirm & Join Queue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <h3>✅ Success!</h3>
              <p>{successMessage}</p>
              <div className={styles.queueModalActions}>
                <button 
                  className={styles.queueConfirmButton}
                  onClick={() => setShowSuccessModal(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Modal */}
        {showErrorModal && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <h3>❌ Error</h3>
              <p>{errorMessage}</p>
              <div className={styles.queueModalActions}>
                <button 
                  className={styles.queueCancelButton}
                  onClick={() => setShowErrorModal(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <h3>⚠️ Confirm Action</h3>
              <p>{confirmMessage}</p>
              <div className={styles.queueModalActions}>
                <button 
                  className={styles.queueCancelButton}
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.queueConfirmButton}
                  onClick={() => {
                    if (confirmAction) {
                      confirmAction();
                    }
                  }}
                >
                  Yes, Leave Queue
                </button>
              </div>
            </div>
          </div>
        )}
        </main>
    </ProtectedPageWrapper>
    </>
  );
};

export default AvailableComputers;