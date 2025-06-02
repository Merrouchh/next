import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { fetchActiveUserSessions, fetchUserBalance, fetchComputers } from '../utils/api';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import styles from '../styles/avcomputers.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import DynamicMeta from '../components/DynamicMeta';
import UserLoginModal from '../components/UserLoginModal';
import { toast } from 'react-hot-toast';

export const getServerSideProps = async ({ res }) => {
  // Set cache control headers
  res.setHeader(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  return {
    props: {
      metaData: {
        title: "Computer Status | Merrouch Gaming Center",
        description: "Real-time status of gaming computers. Monitor availability of Normal and VIP PCs.",
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
};

// Computer component
const ComputerBox = ({ 
  computer, 
  isVip, 
  lastUpdate, 
  highlightActive, 
  onOpenLoginModal, 
  isLoading, 
  userAlreadyLoggedIn, 
  userCurrentComputer,
  userInQueue,
  hasQueueConflict
}) => {
  // If component is in loading state, show a skeleton
  if (isLoading) {
    return (
      <div className={`${isVip ? styles.vipPcBox : styles.pcSquare} ${styles.loadingComputer}`}>
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

  const boxClass = isVip ? styles.vipPcBox : styles.pcSquare;
  const activeClass = computer.isActive
    ? totalMinutes < 60
      ? isVip ? styles.orange : styles.warning
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
        ${(userInQueue || hasQueueConflict) && !computer.isActive ? styles.queueWaiting : ''}
      `}
    >
      {isUserCurrentComputer && (
        <div className={styles.currentUserBadge}>Your Session</div>
      )}
      <div className={styles.pcNumber}>
        {isVip ? 'VIP PC' : 'PC'}{computer.number}
      </div>
      <div className={styles.statusText}>
        {computer.isActive 
          ? `Active - Time Left: ${computer.timeLeft}` 
          : 'No User'}
      </div>
      
      {/* Show login button only for available computers and if user is not already logged in elsewhere */}
      {!computer.isActive && !userAlreadyLoggedIn && (
        <button 
          className={`${styles.loginButton} ${(userInQueue || hasQueueConflict) ? styles.loginButtonDisabled : ''}`}
          onClick={(userInQueue || hasQueueConflict) ? undefined : () => onOpenLoginModal({
            hostId: computer.id,
            type: isVip ? 'VIP' : 'Normal',
            number: computer.number
          })}
          disabled={userInQueue || hasQueueConflict}
          title={
            userInQueue 
              ? "You are in queue - please wait for your turn" 
              : hasQueueConflict 
                ? "Join queue - people are waiting for this PC type"
                : "Login to this computer"
          }
        >
          {userInQueue ? 'In Queue' : hasQueueConflict ? 'Join Queue' : 'Login'}
        </button>
      )}
    </div>
  );
};

// VIP Computers section
const VIPComputers = ({ 
  computers, 
  lastUpdate, 
  highlightActive, 
  onOpenLoginModal, 
  userAlreadyLoggedIn,
  userCurrentComputer,
  isComputerLoaded,
  userInQueue,
  hasQueueConflict
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
        <h2 className={styles.sectionHeading}>VIP PCs</h2>
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
              isVip={true}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
              onOpenLoginModal={onOpenLoginModal}
              isLoading={!isComputerLoaded(computer.id)}
              userAlreadyLoggedIn={userAlreadyLoggedIn}
              userCurrentComputer={userCurrentComputer}
              userInQueue={userInQueue}
              hasQueueConflict={hasQueueConflict}
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
 * 1. View the status of all computers (normal and VIP)
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
  // Track queue status - smart blocking based on computer type
  const [queueStatus, setQueueStatus] = useState({ 
    hasQueue: false, 
    count: 0,
    byType: { normal: 0, vip: 0, any: 0 }
  });
  const [showJoinQueueModal, setShowJoinQueueModal] = useState(false);
  const [queueJoinData, setQueueJoinData] = useState({
    user_name: '',
    phone_number: '',
    computer_type: 'any',
    notes: ''
  });
  const [selectedComputerForQueue, setSelectedComputerForQueue] = useState(null);
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false);
  const [userQueuePosition, setUserQueuePosition] = useState(null);
  // State for tracking previous queue position for notifications
  const [previousQueuePosition, setPreviousQueuePosition] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  // State for connection status
  const [isOffline, setIsOffline] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  // State for tracking queue data loading
  const [queueDataLoaded, setQueueDataLoaded] = useState(false);
  const [userQueueStatusLoaded, setUserQueueStatusLoaded] = useState(false);
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting'); // connecting, connected, disconnected

  // Move computersList to useMemo to prevent unnecessary recreations
  const computersList = useMemo(() => ({
    normal: [
      { number: 1, id: 26 }, { number: 2, id: 12 },
      { number: 3, id: 8 }, { number: 4, id: 5 },
      { number: 5, id: 17 }, { number: 6, id: 11 },
      { number: 7, id: 16 }, { number: 8, id: 14 }
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

  // Reset loading states when user changes
  useEffect(() => {
    if (user) {
      setQueueDataLoaded(false);
      setUserQueueStatusLoaded(false);
    }
  }, [user]);

  // Combined real-time subscription for queue status and user position
  useEffect(() => {
    if (!user || !supabase) {
      setQueueDataLoaded(true);
      setUserQueueStatusLoaded(true);
      return;
    }

    // Initial load
    const loadInitialData = async () => {
      try {
        setIsRefreshingQueue(true);
        
        // Load queue status
        const response = await fetch('/api/computer-queue?count_only=true');
        if (response.ok) {
          const data = await response.json();
          const queueLength = data.queue?.length || 0;
          const queueByType = data.queueByType || { normal: 0, vip: 0, any: 0 };
          
          setQueueStatus({
            hasQueue: queueLength > 0,
            count: queueLength,
            byType: queueByType
          });
          setQueueDataLoaded(true);
        }
        
        // Check user's queue position
        await checkIfUserInQueue();
        setConnectionError(false);
        
      } catch (error) {
        console.error('Error loading initial data:', error);
        setConnectionError(true);
        setQueueStatus({ 
          hasQueue: false, 
          count: 0, 
          byType: { normal: 0, vip: 0, any: 0 }
        });
        setQueueDataLoaded(true);
        setUserQueueStatusLoaded(true);
      } finally {
        setIsRefreshingQueue(false);
      }
    };

    loadInitialData();

    // Set up single real-time subscription for all queue changes
    const queueSubscription = supabase
      .channel('combined-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'computer_queue'
        },
        (payload) => {
          console.log('Real-time queue change detected:', payload);
          setIsRefreshingQueue(true);
          
          // Refresh both queue status and user position when any change occurs
          setTimeout(async () => {
            try {
              // Refresh general queue status
              const response = await fetch('/api/computer-queue?count_only=true');
              if (response.ok) {
                const data = await response.json();
                const queueLength = data.queue?.length || 0;
                const queueByType = data.queueByType || { normal: 0, vip: 0, any: 0 };
                
                setQueueStatus({
                  hasQueue: queueLength > 0,
                  count: queueLength,
                  byType: queueByType
                });
              }
              
              // Refresh user's queue position (this will catch position changes)
              await checkIfUserInQueue();
              setConnectionError(false);
              
            } catch (error) {
              console.error('Error refreshing data on real-time update:', error);
              setConnectionError(true);
            } finally {
              setIsRefreshingQueue(false);
            }
          }, 100); // Small delay to ensure DB consistency
        }
      )
      .subscribe((status) => {
        console.log('Combined queue subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time queue and position updates active');
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ Real-time connection error');
          setRealtimeStatus('disconnected');
        }
      });

    // Fallback polling if real-time fails
    let fallbackInterval;
    const startFallback = () => {
      console.log('🔄 Starting fallback polling due to real-time issues');
      fallbackInterval = setInterval(async () => {
        if (realtimeStatus === 'disconnected') {
          try {
            const response = await fetch('/api/computer-queue?count_only=true');
            if (response.ok) {
              const data = await response.json();
              const queueLength = data.queue?.length || 0;
              const queueByType = data.queueByType || { normal: 0, vip: 0, any: 0 };
              
              setQueueStatus({
                hasQueue: queueLength > 0,
                count: queueLength,
                byType: queueByType
              });
            }
            await checkIfUserInQueue();
          } catch (error) {
            console.error('Fallback polling error:', error);
          }
        }
      }, 10000); // Poll every 10 seconds as fallback
    };

    // Start fallback if connection fails after 30 seconds
    const fallbackTimer = setTimeout(() => {
      if (realtimeStatus !== 'connected') {
        startFallback();
      }
    }, 30000);

    return () => {
      console.log('🔌 Unsubscribing from combined queue changes');
      clearTimeout(fallbackTimer);
      if (fallbackInterval) clearInterval(fallbackInterval);
      supabase.removeChannel(queueSubscription);
    };
  }, [user, supabase]);

  // Check if current user is already in queue
  const checkIfUserInQueue = async () => {
    if (!user || !supabase) {
      setUserQueuePosition(null);
      setUserQueueStatusLoaded(true);
      return { in_queue: false };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setUserQueuePosition(null);
        setUserQueueStatusLoaded(true);
        return { in_queue: false };
      }

      const response = await fetch('/api/computer-queue?check_status=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.in_queue) {
          setUserQueuePosition(data.entry);
        } else {
          setUserQueuePosition(null);
        }
        setUserQueueStatusLoaded(true);
        return data;
      }
    } catch (error) {
      console.error('Error checking user queue status:', error);
    }

    setUserQueuePosition(null);
    setUserQueueStatusLoaded(true);
    return { in_queue: false };
  };

  // Smart conflict detection - check if remote login conflicts with queue
  const hasQueueConflict = useCallback((computerType) => {
    const { byType } = queueStatus;
    
    // If someone is waiting for "any" type, they block all remote logins
    if (byType.any > 0) {
      return true;
    }
    
    // Check for specific type conflicts
    if (computerType === 'Normal' && byType.normal > 0) {
      return true;
    }
    
    if (computerType === 'VIP' && byType.vip > 0) {
      return true;
    }
    
    return false;
  }, [queueStatus]);

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
              const computerType = userComputer.number <= 8 ? 'Normal' : 'VIP';
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
    // First check if user is already in queue
    const queueStatus = await checkIfUserInQueue();
    
    if (queueStatus.in_queue) {
      // User is already in queue - show their current position
      toast.success(queueStatus.message);
      return;
    }

    // Smart queue conflict check - offer to join queue if there's a conflict
    if (hasQueueConflict(computer.type)) {
      setSelectedComputerForQueue(computer);
      
      // Pre-fill the computer type based on what they were trying to access
      const computerType = computer.type === 'VIP' ? 'vip' : 'normal';
      
      // Get user's profile information to pre-fill the form
      try {
        const { data: userProfile, error } = await supabase
          .from('users')
          .select('username, phone')
          .eq('id', user.id)
          .single();
        
        if (userProfile && !error) {
          const computerTypeLabel = computerType === 'vip' ? 'VIP PC' : computerType === 'normal' ? 'Normal PC' : 'any available PC';
          setQueueJoinData(prev => ({
            ...prev,
            computer_type: computerType,
            user_name: userProfile.username || '',
            phone_number: userProfile.phone || '',
            notes: `If it's my turn, please log me automatically into ${computerTypeLabel}`
          }));
          setIsEditingContactInfo(false); // Start with fields locked
        } else {
          // Fallback if we can't get user profile
          const computerTypeLabel = computerType === 'vip' ? 'VIP PC' : computerType === 'normal' ? 'Normal PC' : 'any available PC';
          setQueueJoinData(prev => ({
            ...prev,
            computer_type: computerType,
            user_name: '',
            phone_number: '',
            notes: `If it's my turn, please log me automatically into ${computerTypeLabel}`
          }));
          setIsEditingContactInfo(true); // If no profile data, allow editing
        }
      } catch (error) {
        console.error('Error fetching user profile for queue:', error);
        // Fallback to empty form
        const computerTypeLabel = computerType === 'vip' ? 'VIP PC' : computerType === 'normal' ? 'Normal PC' : 'any available PC';
        setQueueJoinData(prev => ({
          ...prev,
          computer_type: computerType,
          user_name: '',
          phone_number: '',
          notes: `If it's my turn, please log me automatically into ${computerTypeLabel}`
        }));
        setIsEditingContactInfo(true); // If error, allow editing
      }
      
      setShowJoinQueueModal(true);
      return;
    }

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
    const computerSection = computerType === 'vip' ? 'vip' : 'normal';
    
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

  // Handle joining the queue
  const handleJoinQueue = async (e) => {
    e.preventDefault();
    
    if (!queueJoinData.user_name || !queueJoinData.phone_number || !queueJoinData.computer_type) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/computer-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          ...queueJoinData,
          self_service: true,
          user_id: user?.id
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Show success message with position information
        toast.success(data.message);
        setShowJoinQueueModal(false);
        
        // Reset form
        setQueueJoinData({
          user_name: '',
          phone_number: '',
          computer_type: 'any',
          notes: ''
        });
        
        // Real-time system will automatically update the UI
        // No manual refresh needed - the subscription will handle it
        
      } else if (response.status === 409) {
        // User is already in queue - show their position
        if (data.is_duplicate && data.existing_entry) {
          toast.success(`You are already in the queue at position #${data.existing_entry.position}`);
        } else {
          toast.error(data.error || 'You are already in the queue');
        }
        setShowJoinQueueModal(false);
      } else {
        toast.error(data.error || 'Failed to join queue');
      }
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error('Failed to join queue. Please try again.');
    }
  };

  // Handle leaving the queue
  const handleLeaveQueue = async () => {
    if (!userQueuePosition) {
      toast.error('You are not currently in the queue');
      return;
    }

    // Confirm before leaving
    const confirmed = window.confirm('Are you sure you want to leave the queue? You will lose your place in line.');
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`/api/computer-queue?id=${userQueuePosition.id}&self_remove=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setUserQueuePosition(null);
        
                 // Real-time system will automatically update the UI
         // No manual refresh needed - the subscription will handle it
      } else {
        toast.error(data.error || 'Failed to leave queue');
      }
    } catch (error) {
      console.error('Error leaving queue:', error);
      toast.error('Failed to leave queue. Please try again.');
    }
  };

  // Handle joining queue from the banner button
  const handleJoinQueueFromBanner = async () => {
    // If user is already in queue, show their position
    if (userQueuePosition) {
      const formatComputerType = (type) => {
        switch (type) {
          case 'normal': return 'Normal PC';
          case 'vip': return 'VIP PC';
          case 'any': return 'Any PC';
          default: return type;
        }
      };
      
      toast.success(`You are already #${userQueuePosition.position} in line for ${formatComputerType(userQueuePosition.computer_type)}`);
      return;
    }

    // Open the join queue modal with default settings
    setSelectedComputerForQueue({ type: 'Any', number: 'Any' });
    
    // Get user's profile information to pre-fill the form
    try {
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('username, phone')
        .eq('id', user.id)
        .single();
      
      if (userProfile && !error) {
        setQueueJoinData(prev => ({
          ...prev,
          computer_type: 'any',
          user_name: userProfile.username || '',
          phone_number: userProfile.phone || '',
          notes: 'If it\'s my turn, please log me automatically into any available PC'
        }));
        setIsEditingContactInfo(false);
      } else {
        setQueueJoinData(prev => ({
          ...prev,
          computer_type: 'any',
          user_name: '',
          phone_number: '',
          notes: 'If it\'s my turn, please log me automatically into any available PC'
        }));
        setIsEditingContactInfo(true);
      }
    } catch (error) {
      console.error('Error fetching user profile for queue:', error);
      setQueueJoinData(prev => ({
        ...prev,
        computer_type: 'any',
        user_name: '',
        phone_number: '',
        notes: 'If it\'s my turn, please log me automatically into any available PC'
      }));
      setIsEditingContactInfo(true);
    }
    
    setShowJoinQueueModal(true);
  };

  // Update notes message when computer type changes
  useEffect(() => {
    if (showJoinQueueModal && queueJoinData.computer_type) {
      const computerTypeLabel = queueJoinData.computer_type === 'vip' ? 'VIP PC' : 
                               queueJoinData.computer_type === 'normal' ? 'Normal PC' : 
                               'any available PC';
      
      // Only update if the current notes are the default auto-login message format
      const currentNotes = queueJoinData.notes;
      if (!currentNotes || currentNotes.includes('If it\'s my turn, please log me automatically into')) {
        setQueueJoinData(prev => ({
          ...prev,
          notes: `If it's my turn, please log me automatically into ${computerTypeLabel}`
        }));
      }
    }
  }, [queueJoinData.computer_type, showJoinQueueModal]);

  // Handle closing join queue modal
  const handleCloseJoinQueueModal = () => {
    setShowJoinQueueModal(false);
    setSelectedComputerForQueue(null);
    setQueueJoinData({
      user_name: '',
      phone_number: '',
      computer_type: 'any',
      notes: ''
    });
    setIsEditingContactInfo(false);
  };

  // Check if a specific computer has loaded data
  const isComputerLoaded = useCallback((computerId) => {
    return loadedComputers[computerId] === true;
  }, [loadedComputers]);

  // Calculate estimated wait time based on position
  const calculateEstimatedWaitTime = useCallback((position) => {
    if (!position || position <= 1) return null;
    
    // Estimate 15-30 minutes per person ahead in queue
    const avgWaitPerPerson = 20; // minutes
    const estimatedMinutes = (position - 1) * avgWaitPerPerson;
    
    if (estimatedMinutes < 60) {
      return `~${estimatedMinutes} minutes`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return minutes > 0 ? `~${hours}h ${minutes}m` : `~${hours}h`;
    }
  }, []);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted');
      });
    } else if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Check for queue position changes and send notifications
  useEffect(() => {
    if (userQueuePosition && previousQueuePosition && notificationsEnabled) {
      const currentPos = userQueuePosition.position;
      const prevPos = previousQueuePosition.position;
      
      if (currentPos < prevPos) {
        // Position improved - trigger immediate refresh for more responsive updates
        const improvement = prevPos - currentPos;
        new Notification('Queue Update', {
          body: `You moved up ${improvement} ${improvement === 1 ? 'spot' : 'spots'}! You're now #${currentPos} in line.`,
          icon: '/favicon.ico',
          tag: 'queue-update'
        });
        
        // Real-time system will automatically update the UI
        // No manual refresh needed - the subscription handles all changes
        
      } else if (currentPos === 1 && prevPos > 1) {
        // They're next!
        new Notification('You\'re Next!', {
          body: 'You are next in line! Get ready to game.',
          icon: '/favicon.ico',
          tag: 'queue-next'
        });
      }
    }
    
    setPreviousQueuePosition(userQueuePosition);
  }, [userQueuePosition, previousQueuePosition, notificationsEnabled]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setConnectionError(false);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // If the page is not yet ready or queue data is still loading, show the full page loading screen
  if (!pageReady || !queueDataLoaded || !userQueueStatusLoaded) {
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
          <div className={`${styles.liveDot} 
            ${isOffline ? styles.offlineDot : ''} 
            ${isRefreshingQueue ? styles.refreshingDot : ''} 
            ${realtimeStatus === 'connected' ? styles.realtimeDot : ''}
            ${realtimeStatus === 'disconnected' ? styles.disconnectedDot : ''}
          `}></div>
          <span className={styles.liveText}>
            {isOffline ? 'Offline' : 
             isRefreshingQueue ? 'Updating...' : 
             realtimeStatus === 'connected' ? 'Real-time' :
             realtimeStatus === 'disconnected' ? 'Reconnecting...' : 
             'Live'}
          </span>
        </div>
        
        {/* Connection Status Banner */}
        {(isOffline || connectionError) && (
          <div className={styles.connectionBanner}>
            <div className={styles.connectionIcon}>⚠️</div>
            <div className={styles.connectionMessage}>
              {isOffline 
                ? 'You are currently offline. Queue information may not be up to date.'
                : 'Connection issues detected. Some features may not work properly.'
              }
            </div>
          </div>
        )}
        
        {/* Queue Status Banner */}
        {queueStatus.hasQueue && (
          <div className={`${styles.queueBanner} ${userQueuePosition ? styles.userInQueue : ''}`}>
            <div className={styles.queueIcon}>⏳</div>
            <div className={styles.queueMessage}>
              <div className={styles.queueTitle}>
                <strong>Queue Active - Remote Logins Limited</strong>
              </div>
              <div className={styles.queueDetails}>
                {queueStatus.byType.normal > 0 && `${queueStatus.byType.normal} waiting for Normal PCs`}
                {queueStatus.byType.normal > 0 && queueStatus.byType.vip > 0 && ' • '}
                {queueStatus.byType.vip > 0 && `${queueStatus.byType.vip} waiting for VIP PCs`}
                {(queueStatus.byType.normal > 0 || queueStatus.byType.vip > 0) && queueStatus.byType.any > 0 && ' • '}
                {queueStatus.byType.any > 0 && `${queueStatus.byType.any} waiting for any PC`}
              </div>
              <div className={styles.queueExplanation}>
                {userAlreadyLoggedIn 
                  ? `You are currently logged into ${userCurrentComputer?.type} PC ${userCurrentComputer?.number}. Remote logins for conflicting PC types are disabled while others wait.`
                  : 'People are waiting physically at the gaming center. Remote logins for conflicting PC types are disabled to ensure fair access.'
                }
              </div>
              {userQueuePosition && (
                <div className={styles.userQueueStatus}>
                  <strong>
                    You are #{userQueuePosition.position} in line for{' '}
                    {userQueuePosition.computer_type === 'normal' ? 'Normal PC' : 
                     userQueuePosition.computer_type === 'vip' ? 'VIP PC' : 'Any PC'}
                  </strong>
                  {calculateEstimatedWaitTime(userQueuePosition.position) && (
                    <div className={styles.estimatedWaitTime}>
                      Estimated wait: {calculateEstimatedWaitTime(userQueuePosition.position)}
                    </div>
                  )}
                </div>
              )}
            </div>
            {!userAlreadyLoggedIn && (
              <div className={styles.queueButtonGroup}>
                <button 
                  className={userQueuePosition ? styles.queuePositionButton : styles.joinQueueButton}
                  onClick={handleJoinQueueFromBanner}
                >
                  {userQueuePosition ? `#${userQueuePosition.position} in Queue` : 'Join Queue'}
                </button>
                {userQueuePosition && (
                  <button 
                    className={styles.leaveQueueButton}
                    onClick={handleLeaveQueue}
                    title="Leave the queue"
                  >
                    Leave Queue
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        
        <h2 className={styles.sectionHeading}>Normal Computers</h2>
        <div className={styles.computerGrid}>
          {computers.normal.map(computer => (
            <ComputerBox 
              key={computer.id} 
              computer={computer} 
              isVip={false}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
              onOpenLoginModal={handleOpenLoginModal}
              isLoading={!isComputerLoaded(computer.id)}
              userAlreadyLoggedIn={userAlreadyLoggedIn}
              userCurrentComputer={userCurrentComputer}
              userInQueue={!!userQueuePosition}
              hasQueueConflict={hasQueueConflict('Normal')}
            />
          ))}
        </div>

        <VIPComputers 
          computers={computers.vip} 
          lastUpdate={lastUpdate}
          highlightActive={highlightActive}
          onOpenLoginModal={handleOpenLoginModal}
          userAlreadyLoggedIn={userAlreadyLoggedIn}
          userCurrentComputer={userCurrentComputer}
          isComputerLoaded={isComputerLoaded}
          userInQueue={!!userQueuePosition}
          hasQueueConflict={hasQueueConflict('VIP')}
        />
        
        {/* User confirmation login modal */}
        <UserLoginModal 
          isOpen={loginModalState.isOpen}
          onClose={handleCloseLoginModal}
          selectedComputer={loginModalState.selectedComputer}
          onSuccess={handleLoginSuccess}
          autoLoginUser={loginModalState.autoLogin}
        />

        {/* Join Queue Modal */}
        {showJoinQueueModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Join the Queue</h3>
                <button 
                  className={styles.closeButton}
                  onClick={handleCloseJoinQueueModal}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.modalContent}>
                <div className={styles.queueInfo}>
                  <p>
                    <strong>Remote login is currently blocked</strong> because there are people waiting for {selectedComputerForQueue?.type} computers.
                  </p>
                  <p>
                    Would you like to join the queue? You'll be notified when it's your turn!
                  </p>
                  
                  <div className={styles.queueStats}>
                    {queueStatus.byType.normal > 0 && (
                      <span>🟦 {queueStatus.byType.normal} waiting for Normal PCs</span>
                    )}
                    {queueStatus.byType.vip > 0 && (
                      <span>🟪 {queueStatus.byType.vip} waiting for VIP PCs</span>
                    )}
                    {queueStatus.byType.any > 0 && (
                      <span>🟩 {queueStatus.byType.any} waiting for any PC</span>
                    )}
                  </div>
                </div>
                
                <form onSubmit={handleJoinQueue} className={styles.queueForm}>
                  <div className={styles.contactInfoSection}>
                    <div className={styles.contactInfoHeader}>
                      <h4>Contact Information</h4>
                      {!isEditingContactInfo && queueJoinData.user_name && (
                        <button 
                          type="button" 
                          className={styles.editButton}
                          onClick={() => setIsEditingContactInfo(true)}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="queue_user_name">Your Name *</label>
                      <input
                        type="text"
                        id="queue_user_name"
                        value={queueJoinData.user_name}
                        onChange={(e) => setQueueJoinData(prev => ({ ...prev, user_name: e.target.value }))}
                        required
                        placeholder="Enter your full name"
                        disabled={!isEditingContactInfo}
                        className={!isEditingContactInfo ? styles.disabledInput : ''}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="queue_phone_number">Phone Number *</label>
                      <input
                        type="tel"
                        id="queue_phone_number"
                        value={queueJoinData.phone_number}
                        onChange={(e) => setQueueJoinData(prev => ({ ...prev, phone_number: e.target.value }))}
                        required
                        placeholder="Enter your phone number"
                        disabled={!isEditingContactInfo}
                        className={!isEditingContactInfo ? styles.disabledInput : ''}
                      />
                      {!isEditingContactInfo && queueJoinData.phone_number && (
                        <small className={styles.contactNote}>
                          Gaming center will call this number when it's your turn
                        </small>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="queue_computer_type">Preferred Computer Type</label>
                    <select
                      id="queue_computer_type"
                      value={queueJoinData.computer_type}
                      onChange={(e) => setQueueJoinData(prev => ({ ...prev, computer_type: e.target.value }))}
                    >
                      <option value="normal">Normal PC</option>
                      <option value="vip">VIP PC</option>
                      <option value="any">Any Available PC</option>
                    </select>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="queue_notes">
                      Special Requests (Optional)
                      <small className={styles.fieldHelper}>You can edit or clear this message</small>
                    </label>
                    <textarea
                      id="queue_notes"
                      value={queueJoinData.notes}
                      onChange={(e) => setQueueJoinData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any special requests or notes..."
                      rows={3}
                      className={styles.notesTextarea}
                    />
                  </div>
                  
                  <div className={styles.modalActions}>
                    <button 
                      type="button" 
                      className={styles.cancelButton}
                      onClick={handleCloseJoinQueueModal}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className={styles.submitButton}
                    >
                      Join Queue
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedPageWrapper>
  );
};

export default AvailableComputers;