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
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
  const [queueStatus, setQueueStatus] = useState(null);
  const [userInQueue, setUserInQueue] = useState(null);
  const [showQueueModal, setShowQueueModal] = useState(false);

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

  // Fetch queue status
  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        console.log('Queue status data:', data);
        // Handle case where status is returned as an array
        const status = Array.isArray(data.status) ? data.status[0] : data.status;
        console.log('Queue status:', status);
        setQueueStatus(status);
        
        // Check if current user is in queue
        if (user?.id && data.queue) {
          const userQueueEntry = data.queue.find(entry => entry.user_id === user.id);
          setUserInQueue(userQueueEntry || null);
        }
      }
    } catch (error) {
      console.error('Error fetching queue status:', error);
    }
  };

  // Join queue
  const joinQueue = async (computerType = 'any') => {
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
        alert(result.message);
        fetchQueueStatus(); // Refresh queue status
        setShowQueueModal(false);
      } else {
        alert('Error joining queue: ' + result.error);
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      alert('Error joining queue');
    }
  };

  // Leave queue
  const leaveQueue = async () => {
    if (!userInQueue) return;
    
    if (!confirm('Are you sure you want to leave the queue?')) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch(`/api/queue/manage?id=${userInQueue.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        alert('You have left the queue');
        fetchQueueStatus(); // Refresh queue status
      } else {
        const errorData = await response.json();
        alert('Error leaving queue: ' + errorData.error);
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      alert('Error leaving queue');
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

  // Fetch queue status on component mount and set up real-time subscriptions
  useEffect(() => {
    if (user) {
      fetchQueueStatus();
      
      // Set up real-time subscriptions for queue changes
      const queueSubscription = supabase
        .channel('queue-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'computer_queue'
        }, () => {
          console.log('Queue data changed, refreshing...');
          fetchQueueStatus();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'queue_settings'
        }, () => {
          console.log('Queue settings changed, refreshing...');
          fetchQueueStatus();
        })
        .subscribe();

      // Backup polling every 30 seconds (reduced from 10)
      const queueInterval = setInterval(fetchQueueStatus, 30000);
      
      return () => {
        queueSubscription.unsubscribe();
        clearInterval(queueInterval);
      };
    }
  }, [user, supabase]);

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
      // If user is in queue, show different message
      if (userInQueue) {
        alert(`You are currently in the queue at position ${userInQueue.position}. Please wait for your turn.`);
        return;
      }
      
      // If queue is active but user not in queue, prompt to join
      if (queueStatus.allow_online_joining) {
        setShowQueueModal(true);
        return;
      } else {
        alert("A queue is currently active and online joining is disabled. Please visit the gaming center to join the physical queue.");
        return;
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
  const handleLoginSuccess = (user, computer) => {
    console.log(`User ${user.username} (ID: ${user.gizmoId}) logged in to ${computer.type} ${computer.number} (Host ID: ${computer.hostId})`);
    
    // Update UI to show the computer is now in use
    const computerType = computer.type.toLowerCase();
    const computerSection = computerType === 'top' ? 'vip' : 'normal';
    
    // Mark the computer as being updated
    setLastUpdate(prev => ({ ...prev, [computer.hostId]: Date.now() }));
    
    // Set user as logged in immediately and track which computer
    setUserAlreadyLoggedIn(true);
    setUserCurrentComputer(computer);
    
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
                  <span className={styles.queuePosition}>You are position #{userInQueue.position}</span>
                  <button className={styles.leaveQueueButton} onClick={leaveQueue}>
                    Leave Queue
                  </button>
                </div>
              ) : (
                <div className={styles.queueInfo}>
                  <span>{queueStatus.current_queue_size} people waiting</span>
                  {queueStatus.allow_online_joining && (
                    <button className={styles.joinQueueButton} onClick={() => setShowQueueModal(true)}>
                      Join Queue
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className={styles.queueMessage}>
              {userInQueue 
                ? `Estimated wait time: ${userInQueue.position * 5} minutes`
                : queueStatus.allow_online_joining 
                  ? "People are waiting for computers. Join the queue to get notified when it's your turn."
                  : "People are waiting for computers. Visit the gaming center to join the physical queue."
              }
            </p>
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
              <h3>Join Queue</h3>
              <p>All computers are currently occupied. Would you like to join the queue?</p>
              
              <div className={styles.queueModalOptions}>
                <h4>Computer Preference:</h4>
                <div className={styles.preferenceButtons}>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => joinQueue('any')}
                  >
                    Any Available Computer
                  </button>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => joinQueue('bottom')}
                  >
                    Bottom Floor Only
                  </button>
                  <button 
                    className={styles.preferenceButton}
                    onClick={() => joinQueue('top')}
                  >
                    Top Floor Only
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
      </main>
    </ProtectedPageWrapper>
  );
};

export default AvailableComputers;