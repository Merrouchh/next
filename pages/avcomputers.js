import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { fetchActiveUserSessions, fetchUserBalance, fetchComputers, loginUserToComputer } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';
import styles from '../styles/avcomputers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { createClient as createServerClient } from '../utils/supabase/server-props';
import DynamicMeta from '../components/DynamicMeta';
import { MdChevronRight } from 'react-icons/md';
import UserLoginModal from '../components/UserLoginModal';

// We can remove cache headers since they're handled globally in next.config.js
export const getServerSideProps = async ({ res }) => {
  // Set cache control headers
  res.setHeader(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0'
  );
  // Cache headers removed

  try {
    const computers = await fetchComputers();
    return {
      props: {
        computers,
        timestamp: Date.now(), // Keep timestamp to force revalidation
        metaData: {
          title: "Computer Status | Merrouch Gaming Center",
          description: "Real-time status of gaming computers. Monitor availability of Bottom and Top floor PCs.",
          image: "https://merrouchgaming.com/top.jpg",
          url: "https://merrouchgaming.com/avcomputers",
          type: "website",
          noindex: true, // Tell search engines not to index this page
          openGraph: {
            title: "Computer Status | Merrouch Gaming Center",
            description: "Real-time computer availability dashboard",
            images: [
              {
                url: "https://merrouchgaming.com/top.jpg",
                width: 1200,
                height: 630,
                alt: "Merrouch Gaming Computer Status"
              }
            ],
            type: "website"
          }
        }
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
        timestamp: Date.now(),
        metaData: {
          title: "Computer Status | Merrouch Gaming Center",
          description: "Real-time status of gaming computers",
          noindex: true,
          type: "website"
        }
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
  isLoading, 
  userAlreadyLoggedIn,
  userCurrentComputer,
  isComputerLoaded
}) => {
  const vipContainerRef = useRef(null);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [currentPair, setCurrentPair] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

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

  // Only run scroll handling on mobile
  const handleScroll = useCallback((e) => {
    if (!isMobile || !e.target) return;
    
    const container = e.target;
    const pairWidth = container.clientWidth;
    const currentScrollPosition = container.scrollLeft;
    const currentPairIndex = Math.round(currentScrollPosition / pairWidth);
    
    setCurrentPair(currentPairIndex);
    setIsAtStart(currentPairIndex === 0);
    setIsAtEnd(currentPairIndex === totalPairs);
  }, [isMobile, totalPairs]);

  const handleScrollButton = useCallback((direction) => {
    if (!isMobile || !vipContainerRef.current) return;
    
    const container = vipContainerRef.current;
    const pairWidth = container.clientWidth;
    
    const newPairIndex = direction === 'left' ? 
      Math.max(0, currentPair - 1) : 
      Math.min(totalPairs, currentPair + 1);
    
    container.scrollTo({
      left: newPairIndex * pairWidth,
      behavior: 'smooth'
    });
    
    setCurrentPair(newPairIndex);
    setIsAtStart(newPairIndex === 0);
    setIsAtEnd(newPairIndex === totalPairs);
  }, [isMobile, currentPair, totalPairs]);

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
const useQueueSystem = (user, supabase) => {
  const [queueStatus, setQueueStatus] = useState(null);
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
        setQueueStatus(status);
        
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
      // Set default status to prevent UI errors
      setQueueStatus({ 
        is_active: false, 
        allow_online_joining: false, 
        current_queue_size: 0,
        automatic_mode: false 
      });
    }
  }, [user]);

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
      alert('You are already in the queue!');
      return false;
    }

    setIsJoiningQueue(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ computerType })
      });

      const result = await response.json();
      
      if (response.ok) {
        // Immediately update local state to prevent duplicate joins
        setUserInQueue({ 
          position: result.position || 1, 
          computer_type: computerType,
          id: result.id 
        });
        alert('You have been added to the queue! We\'ll notify you when a computer becomes available.');
        return true;
      } else {
        alert('Unable to join queue: ' + result.error);
        return false;
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      alert('Error joining queue');
      return false;
    } finally {
      setIsJoiningQueue(false);
    }
  };

  const leaveQueue = async () => {
    if (!userInQueue || !confirm('Are you sure you want to leave the queue?')) return;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/queue/join', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        alert('You have left the queue');
        return true;
      } else {
        const errorData = await response.json();
        alert('Error leaving queue: ' + errorData.error);
        return false;
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      alert('Error leaving queue');
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
const AvailableComputers = ({ metaData }) => {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [computers, setComputers] = useState({ normal: [], vip: [] });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageReady, setPageReady] = useState(false); // State for full page readiness
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
  const { queueStatus, userInQueue, fetchQueueStatus, joinQueue, leaveQueue, isJoiningQueue } = useQueueSystem(user, supabase);

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
      
      // Only set loading to false after a short delay to ensure UI updates
      setTimeout(() => {
        setIsLoading(false);
        setPageReady(true);
      }, 500);
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
        // Allow position #1 to login directly
        if (userInQueue.position === 1) {
          // Position #1 can login - continue with normal login process
        } else {
          // Other positions must wait
          alert(`You are currently in the queue at position ${userInQueue.position}. Please wait for your turn.`);
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

  // Check if all computers are occupied (14/14)
  const areAllComputersOccupied = useMemo(() => {
    const totalComputers = 14; // 8 bottom + 6 top
    const occupiedComputers = [...computers.normal, ...computers.vip].filter(computer => computer.isActive).length;
    return occupiedComputers === totalComputers;
  }, [computers.normal, computers.vip]);

  // Determine if we should show "Join Queue" option
  const shouldShowQueueJoin = useMemo(() => {
    return (
      areAllComputersOccupied && // All computers are full
      !userInQueue && // User is not already in queue
      !userAlreadyLoggedIn && // User is not already logged into a computer
      (!queueStatus || (!queueStatus.is_active && queueStatus.current_queue_size === 0)) // Queue is inactive and empty
    );
  }, [areAllComputersOccupied, userInQueue, userAlreadyLoggedIn, queueStatus]);

  // If the page is not yet ready, show the full page loading screen
  if (!pageReady) {
    return (
      <ProtectedPageWrapper>
        <div className={styles.loading}>
          <div className={styles.loadingDot}></div>
          <div className={styles.loadingDot}></div>
          <div className={styles.loadingDot}></div>
        </div>
      </ProtectedPageWrapper>
    );
  }

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
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} />
      <main className={styles.mainContainer}>
        <div className={styles.liveIndicator}>
          <div className={styles.liveDot}></div>
          <span className={styles.liveText}>Live</span>
        </div>

        {/* Queue Status Display */}
        {queueStatus && (queueStatus.is_active || queueStatus.current_queue_size > 0) && (
          <div className={styles.queueStatus}>
            <div className={styles.queueStatusHeader}>
              <h3>🎮 {queueStatus.is_active ? 'Queue System Active' : 'People Waiting in Queue'}</h3>
              {userInQueue ? (
                <div className={styles.userQueueInfo}>
                  <span className={styles.queuePosition}>
                    You are position #{userInQueue.position || '?'}
                    {userInQueue.position === 1 && <span style={{color: '#059669', fontWeight: 'bold'}}> - It's your turn!</span>}
                  </span>
                  <button className={styles.leaveQueueButton} onClick={leaveQueue}>
                    Leave Queue
                  </button>
                </div>
              ) : (
                <div className={styles.queueInfo}>
                  <span>{queueStatus.current_queue_size} people waiting</span>
                  {queueStatus.allow_online_joining && (
                    <button 
                      className={styles.joinQueueButton} 
                      onClick={() => setShowQueueModal(true)}
                      disabled={isJoiningQueue}
                    >
                      {isJoiningQueue ? 'Joining...' : 'Join Queue'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className={styles.queueMessage}>
              {userInQueue 
                ? (userInQueue.position === 1 ? "🎉 It's your turn! " : `Estimated wait time: ${userInQueue.position * 5} minutes`)
                : queueStatus.allow_online_joining 
                  ? "People are waiting for computers. Join the queue to get notified when it's your turn."
                  : "People are waiting for computers. Visit the gaming center to join the physical queue."
              }
            </p>
          </div>
        )}



        {/* All Computers Full - Join Waiting List */}
        {shouldShowQueueJoin && (
          <div className={styles.waitingListSection}>
            <div className={styles.waitingListHeader}>
              <h3>🔴 All Computers Occupied ({[...computers.normal, ...computers.vip].filter(c => c.isActive).length}/14)</h3>
              <p>All gaming stations are currently in use. Join our waiting list to be notified when a computer becomes available!</p>
            </div>
            <div className={styles.waitingListActions}>
              <button 
                className={styles.joinWaitingListButton}
                onClick={() => setShowQueueModal(true)}
                disabled={isJoiningQueue}
              >
                {isJoiningQueue ? '📋 Joining...' : '📋 Join Waiting List'}
              </button>
            </div>
            <div className={styles.waitingListInfo}>
              <p>✅ Get notified when it's your turn</p>
              <p>✅ Reserve your preferred computer type</p>
              <p>✅ No need to wait physically at the center</p>
            </div>
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
              <h3>{shouldShowQueueJoin ? 'Join Waiting List' : 'Join Queue'}</h3>
              <p>
                {shouldShowQueueJoin 
                  ? 'All computers are currently occupied. Join our waiting list and we\'ll notify you when a computer becomes available!'
                  : 'All computers are currently occupied. Would you like to join the queue?'
                }
              </p>
              
              <div className={styles.queueModalOptions}>
                <h4>Computer Preference:</h4>
                <div className={styles.preferenceButtons}>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => handleQueueSelection('any')}
                    disabled={isJoiningQueue}
                  >
                    <div className={styles.preferenceTitle}>🎮 Any Available Computer</div>
                    <div className={styles.preferenceSubtitle}>Get the next available computer</div>
                    {queueStatus && (
                      <div className={styles.estimatedWait}>
                        ~{Math.max(5, (queueStatus.current_queue_size || 0) * 5)} min wait
                      </div>
                    )}
                  </button>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => handleQueueSelection('bottom')}
                    disabled={isJoiningQueue}
                  >
                    <div className={styles.preferenceTitle}>⬇️ Bottom Floor Only</div>
                    <div className={styles.preferenceSubtitle}>Bottom floor gaming PCs (PC 1-8)</div>
                    {queueStatus && (
                      <div className={styles.estimatedWait}>
                        ~{Math.max(10, (queueStatus.current_queue_size || 0) * 7)} min wait
                      </div>
                    )}
                  </button>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => handleQueueSelection('top')}
                    disabled={isJoiningQueue}
                  >
                    <div className={styles.preferenceTitle}>⬆️ Top Floor Only</div>
                    <div className={styles.preferenceSubtitle}>Top floor gaming PCs (PC 9-14)</div>
                    {queueStatus && (
                      <div className={styles.estimatedWait}>
                        ~{Math.max(15, (queueStatus.current_queue_size || 0) * 10)} min wait
                      </div>
                    )}
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
                  <strong>You're about to join the queue for {
                    selectedQueueType === 'any' ? 'any available computer' :
                    selectedQueueType === 'bottom' ? 'bottom floor computers' :
                    'top floor computers'
                  }.</strong>
                </p>
                
                <div className={styles.confirmationInfo}>
                  <p>📋 <strong>What happens next:</strong></p>
                  <ul>
                    <li>✅ You'll be added to the waiting list</li>
                    <li>🔔 We'll notify you when it's your turn</li>
                    <li>🎮 <strong>We will automatically log you in</strong> when a computer becomes available</li>
                    <li>❌ If you change your mind, you can remove yourself from the queue</li>
                  </ul>
                </div>

                <div className={styles.importantNote}>
                  <p>⚠️ <strong>Important:</strong> Make sure you're ready to start gaming when it's your turn!</p>
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
      </main>
    </ProtectedPageWrapper>
  );
};

export default AvailableComputers;