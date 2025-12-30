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
import { FaUsers, FaArrowUp, FaArrowDown, FaDesktop, FaTimes } from 'react-icons/fa';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

import { QueuePositionDisplay } from '../components/avcomputers/QueuePositionDisplay';
import { ComputerBox } from '../components/avcomputers/ComputerBox';
import { TopComputers } from '../components/avcomputers/TopComputers';
import { useQueueSystem } from '../hooks/useQueueSystem';

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
  const [userPhone, setUserPhone] = useState(null);
  // Track which computers have loaded data
  const [loadedComputers, setLoadedComputers] = useState({});
  // Queue related states
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueModalStep, setQueueModalStep] = useState('floor'); // 'floor' | 'whatsapp' | 'phone'
  const [pendingQueueType, setPendingQueueType] = useState(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState('');
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
      const fetchUserData = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('gizmo_id, phone')
            .eq('id', user.id)
            .single();
            
          if (data && !error) {
            if (data.gizmo_id) setUserGizmoId(data.gizmo_id);
            setUserPhone(data.phone || null);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      };
      
      fetchUserData();
    }
  }, [user, supabase]);

  // Queue management
  const { queueStatus, queueEntries, userInQueue, fetchQueueStatus, joinQueue, leaveQueue, isJoiningQueue } = useQueueSystem(user, supabase, {
    setErrorMessage,
    setShowErrorModal,
    setSuccessMessage,
    setShowSuccessModal,
    setConfirmMessage,
    setShowConfirmModal,
    setConfirmAction
  });

  const getUserPositionAmongEligibleFromQueue = useCallback((eligibleTypes) => {
    if (!user?.id) return 999;
    const list = Array.isArray(queueEntries) ? queueEntries : [];
    const eligible = list
      .filter(e => (e?.status || 'waiting') === 'waiting')
      .filter(e => eligibleTypes.includes((e?.computer_type || 'any')))
      .sort((a, b) => (a?.position || 0) - (b?.position || 0));

    const idx = eligible.findIndex(e => e?.user_id === user.id);
    return idx === -1 ? 999 : idx + 1;
  }, [queueEntries, user?.id]);

  const userIsNextForTop = useMemo(() => (
    getUserPositionAmongEligibleFromQueue(['any', 'top']) === 1
  ), [getUserPositionAmongEligibleFromQueue]);

  const userIsNextForBottom = useMemo(() => (
    getUserPositionAmongEligibleFromQueue(['any', 'bottom']) === 1
  ), [getUserPositionAmongEligibleFromQueue]);

  const handleJoinQueue = async (queueType = 'any', notifyWhatsapp = true) => {
    if (isJoiningQueue) return;
    const success = await joinQueue(queueType, notifyWhatsapp);
    if (success) {
      // Refresh queue status to get updated data
      fetchQueueStatus();
      closeQueueModal();
    }
  };

  const openQueueModal = () => {
    setShowQueueModal(true);
    setQueueModalStep('floor');
    setPendingQueueType(null);
    setPhoneError('');
    setOtpSent(false);
    setOtpCode('');
    setPhoneDraft('');
  };

  const closeQueueModal = () => {
    setShowQueueModal(false);
    setQueueModalStep('floor');
    setPendingQueueType(null);
    setPhoneError('');
    setOtpSent(false);
    setOtpCode('');
    setPhoneDraft('');
  };

  // Step 1: choose floor (then go to WhatsApp step)
  const handleQueueFloorSelected = (queueType) => {
    if (isJoiningQueue) return;
    setPendingQueueType(queueType);
    setQueueModalStep('whatsapp');
  };

  // Step 2: WhatsApp preference
  const handleWhatsappChoice = async (wantsWhatsapp) => {
    if (!pendingQueueType) return;

    // If user wants WhatsApp but has no phone, force them to add phone first
    if (wantsWhatsapp && !userPhone) {
      setQueueModalStep('phone');
      return;
    }

    await handleJoinQueue(pendingQueueType, wantsWhatsapp);
  };

  const normalizeE164 = (raw) => {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    if (!trimmed) return '';

    // PhoneInput (react-phone-input-2) returns digits without "+" by default.
    // Also handle the common Morocco local format: 06xxxxxxxx -> +2126xxxxxxxx
    // Remove the national trunk prefix "0" if present.
    let normalized = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;

    // Morocco trunk prefix removal:
    // - +2120XXXXXXXXX -> +212XXXXXXXXX
    // - +06XXXXXXXXX   -> +2126XXXXXXXX
    if (normalized.startsWith('+2120')) {
      normalized = `+212${normalized.slice(5)}`;
    } else if (normalized.startsWith('+0')) {
      // treat as local Morocco number
      normalized = `+212${normalized.slice(2)}`;
    }

    return normalized;
  };

  const isValidE164 = (phone) => /^\+[1-9]\d{1,14}$/.test(phone);

  const handleSendOtp = async () => {
    setPhoneError('');
    const phone = normalizeE164(phoneDraft);
    if (!isValidE164(phone)) {
      setPhoneError('Please enter a valid phone number (E.164). Example: +12125551234');
      return;
    }

    try {
      setPhoneSubmitting(true);

      // Create verification attempt record (matches profile flow)
      const recordRes = await fetch('/api/phone/create-verification-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, phone })
      });
      if (!recordRes.ok) {
        const err = await recordRes.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to start phone verification');
      }

      const res = await fetch('/api/verify-phone-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone, userId: user.id })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const msg = data?.message || data?.error || 'Failed to send verification code';
        throw new Error(msg);
      }

      setOtpSent(true);
    } catch (e) {
      setPhoneError(e?.message || 'Failed to send verification code');
    } finally {
      setPhoneSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setPhoneError('');
    const phone = normalizeE164(phoneDraft);
    const code = otpCode.trim();
    if (!isValidE164(phone)) {
      setPhoneError('Phone number is invalid.');
      return;
    }
    if (!code) {
      setPhoneError('Please enter the verification code.');
      return;
    }

    try {
      setPhoneSubmitting(true);
      const res = await fetch('/api/verify-phone-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, code, userId: user.id })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const msg = data?.message || data?.error || 'Failed to verify code';
        throw new Error(msg);
      }

      // Phone is now stored on user; keep local state in sync
      setUserPhone(phone);
      setQueueModalStep('whatsapp');
    } catch (e) {
      setPhoneError(e?.message || 'Failed to verify code');
    } finally {
      setPhoneSubmitting(false);
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
          const computerType = String(computer.type || '').toLowerCase(); // 'top' or 'bottom'
          const isTopComputer = computerType === 'top';
          const computerTypeLabel = isTopComputer ? 'top floor' : 'bottom floor';

          // If user selected a specific floor queue, make mismatch explicit (avoid misleading "position for bottom/top")
          if (userInQueue.computer_type === 'top' && !isTopComputer) {
            alert('You joined the Top Only queue. Please choose a top floor computer.');
            return;
          }
          if (userInQueue.computer_type === 'bottom' && isTopComputer) {
            alert('You joined the Bottom Only queue. Please choose a bottom floor computer.');
            return;
          }

          // Compute breakdown for the clicked computer type (not just the user queue type)
          const eligibleTypesForComputer = isTopComputer ? ['any', 'top'] : ['any', 'bottom'];
          const breakdown = await getQueueBreakdownBeforeUser(userInQueue, eligibleTypesForComputer);
          
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
        // If user isn't in queue, check if anyone is waiting for this computer type
        const hasWaiters = await hasEligibleWaitersForComputer(computer.type);

        if (hasWaiters) {
          // Respect queue: they must join first
        if (queueStatus.allow_online_joining) {
          openQueueModal();
          return;
        }

        alert("Online joining is currently disabled. Please visit the gaming center to join the physical queue.");
        return;
        }
        // No one is waiting for this computer type -> allow direct login
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

  // Helper: is there anyone waiting who could take this computer?
  const hasEligibleWaitersForComputer = async (computerType) => {
    const type = computerType.toLowerCase();
    const anyCount = queueStatus?.any_queue_count || 0;
    const bottomCount = queueStatus?.bottom_queue_count || 0;
    const topCount = queueStatus?.top_queue_count || 0;

    // Use cached counts when available
    if (queueStatus && typeof queueStatus.current_queue_size === 'number') {
      const eligibleCount = type === 'top'
        ? (topCount + anyCount)
        : (bottomCount + anyCount);
      return eligibleCount > 0;
    }

    // Fallback: query Supabase directly
    const eligibleTypes = type === 'top' ? ['any', 'top'] : ['any', 'bottom'];
    const { data, error } = await supabase
      .from('computer_queue')
      .select('id')
      .in('computer_type', eligibleTypes)
      .eq('status', 'waiting')
      .limit(1);

    if (error) {
      console.error('Error checking eligible waiters:', error);
      return true; // Be conservative on error
    }

    return (data || []).length > 0;
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
  // If eligibleQueueTypesOverride is provided, we compute the breakdown for that computer type
  // (ex: clicking Top PC should compute among ['any','top'], even if the user is in another queue type).
  const getQueueBreakdownBeforeUser = useCallback(async (userQueueEntry, eligibleQueueTypesOverride = null) => {
    // Use stable values for cache key, not object properties that might change reference
    const userId = userQueueEntry.user_id || userQueueEntry.id;
    const userPos = userQueueEntry.position;
    const compType = userQueueEntry.computer_type;
    const overrideKey = Array.isArray(eligibleQueueTypesOverride)
      ? eligibleQueueTypesOverride.slice().sort().join(',')
      : 'default';
    const cacheKey = `${userId}-${userPos}-${compType}-${overrideKey}`;
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
      
      if (Array.isArray(eligibleQueueTypesOverride) && eligibleQueueTypesOverride.length > 0) {
        eligibleQueueTypes = eligibleQueueTypesOverride;
      } else if (userQueueEntry.computer_type === 'any') {
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


        {/* Queue UI:
            - If nobody is waiting -> show only Join Queue button
            - If someone is waiting -> show queue container + Join button
        */}
        {(() => {
          const queueCount = queueStatus?.current_queue_size || 0;
          const shouldShowContainer = queueCount > 0 || !!userInQueue;
          const canShowJoin = !userInQueue && !userAlreadyLoggedIn;
          const isOnlineJoinAllowed = !!queueStatus?.allow_online_joining;
          const joinDisabled = !queueStatus || !isOnlineJoinAllowed || isJoiningQueue || !canShowJoin;

          if (!shouldShowContainer) {
            return (
              <div className={styles.queueJoinOnly}>
                <button
                  className={styles.queueJoinButton}
                  onClick={openQueueModal}
                  disabled={joinDisabled}
                  title={!queueStatus ? 'Loading queue...' : (!isOnlineJoinAllowed ? 'Online joining is blocked' : undefined)}
                >
                  {isJoiningQueue ? 'Joining...' : (
                    <>
                      <FaUsers className={styles.queueJoinIcon} />
                      Join Queue
                    </>
                  )}
                </button>
              </div>
            );
          }

          return (
          <div className={styles.compactQueueStatus}>
            <div className={styles.queueHeader}>
              <h3 className={styles.queueHeaderTitle}>
                <FaUsers className={styles.queueHeaderIcon} />
                Queue ({queueCount} waiting)
              </h3>
            </div>

            {/* Queue Breakdown by Computer Type */}
            <div className={styles.queueBreakdown}>
              <div className={styles.queueType}>
                <FaDesktop className={styles.queueIcon} />
                <span className={styles.queueLabel}>Any Computer</span>
                <span className={styles.queueCount}>{queueStatus.any_queue_count || 0}</span>
              </div>
              <div className={styles.queueType}>
                <FaArrowDown className={styles.queueIcon} />
                <span className={styles.queueLabel}>Bottom Only</span>
                <span className={styles.queueCount}>{queueStatus.bottom_queue_count || 0}</span>
              </div>
              <div className={styles.queueType}>
                <FaArrowUp className={styles.queueIcon} />
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
                  Leave Queue
                </button>
              </div>
            )}

            {/* Join Queue Button (always visible; disabled if online joining is blocked) */}
            {canShowJoin && (
              <div className={styles.queueJoinSection}>
                <button
                  className={styles.queueJoinButton}
                  onClick={openQueueModal}
                  disabled={joinDisabled}
                  title={!queueStatus ? 'Loading queue...' : (!isOnlineJoinAllowed ? 'Online joining is blocked' : undefined)}
                >
                  {isJoiningQueue ? 'Joining...' : (
                    <>
                      <FaUsers className={styles.queueJoinIcon} />
                      Join Queue
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          );
        })()}




        
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
              queueStatus={queueStatus}
              userInQueue={userInQueue}
              userIsNextForTop={userIsNextForTop}
              userIsNextForBottom={userIsNextForBottom}
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
          queueStatus={queueStatus}
          userInQueue={userInQueue}
          userIsNextForTop={userIsNextForTop}
          userIsNextForBottom={userIsNextForBottom}
        />
        
        {/* User confirmation login modal */}
        <UserLoginModal 
          isOpen={loginModalState.isOpen}
          onClose={handleCloseLoginModal}
          selectedComputer={loginModalState.selectedComputer}
          onSuccess={handleLoginSuccess}
          autoLoginUser={loginModalState.autoLogin}
        />

        {/* Queue Join Preference Modal - Simplified */}
        {showQueueModal && (
          <div className={styles.queueModal}>
            <div className={styles.queueModalContent}>
              <button 
                className={styles.queueModalClose}
                onClick={closeQueueModal}
                disabled={isJoiningQueue}
                aria-label="Close modal"
              >
                <FaTimes />
              </button>

              {queueModalStep === 'floor' && (
                <>
                  <h3>Choose Computer Floor</h3>
                  <p>Select your preferred floor to join the queue</p>

                  <div className={styles.preferenceButtons}>
                    <button 
                      className={styles.preferenceButton}
                      onClick={() => handleQueueFloorSelected('any')}
                      disabled={isJoiningQueue}
                    >
                      <FaDesktop className={styles.preferenceIcon} />
                      <span className={styles.preferenceLabel}>Any Floor</span>
                    </button>
                    
                    <button 
                      className={styles.preferenceButton}
                      onClick={() => handleQueueFloorSelected('bottom')}
                      disabled={isJoiningQueue}
                    >
                      <FaArrowDown className={styles.preferenceIcon} />
                      <span className={styles.preferenceLabel}>Bottom Floor</span>
                    </button>
                    
                    <button 
                      className={styles.preferenceButton}
                      onClick={() => handleQueueFloorSelected('top')}
                      disabled={isJoiningQueue}
                    >
                      <FaArrowUp className={styles.preferenceIcon} />
                      <span className={styles.preferenceLabel}>Top Floor</span>
                    </button>
                  </div>
                </>
              )}

              {queueModalStep === 'whatsapp' && (
                <>
                  <h3>WhatsApp Notifications</h3>
                  <p>Do you want to receive WhatsApp notifications about your queue status?</p>

                  {!userPhone ? (
                    <>
                      <div className={styles.modalNote}>
                        Your account does not have a phone number yet.
                      </div>
                      <div className={styles.whatsappButtons}>
                        <button
                          className={styles.secondaryActionButton}
                          onClick={() => handleWhatsappChoice(false)}
                          disabled={isJoiningQueue}
                        >
                          No
                        </button>
                        <button
                          className={styles.primaryActionButton}
                          onClick={() => setQueueModalStep('phone')}
                          disabled={isJoiningQueue}
                        >
                          Add phone number
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.modalNote}>
                        Phone: <strong>{userPhone}</strong>
                      </div>
                      <div className={styles.whatsappButtons}>
                        <button
                          className={styles.primaryActionButton}
                          onClick={() => handleWhatsappChoice(true)}
                          disabled={isJoiningQueue}
                        >
                          Yes
                        </button>
                        <button
                          className={styles.secondaryActionButton}
                          onClick={() => handleWhatsappChoice(false)}
                          disabled={isJoiningQueue}
                        >
                          No
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {queueModalStep === 'phone' && (
                <>
                  <h3>Add Phone Number</h3>
                  <p>Enter your phone number to enable WhatsApp notifications.</p>

                  <div className={styles.phoneForm}>
                    <label className={styles.phoneLabel}>Phone (E.164)</label>
                    <div className={styles.phoneInputContainer}>
                      <PhoneInput
                        country={'ma'}
                        preferredCountries={['ma']}
                        value={phoneDraft}
                        onChange={(value) => setPhoneDraft(value)}
                        placeholder="2126xxxxxxx"
                        disabled={phoneSubmitting}
                        inputClass={styles.phoneInput}
                        containerClass={styles.phoneInputContainerInner}
                        buttonClass={styles.phoneInputButton}
                      />
                    </div>

                    {!otpSent ? (
                      <button
                        className={styles.primaryActionButton}
                        onClick={handleSendOtp}
                        disabled={phoneSubmitting}
                      >
                        {phoneSubmitting ? 'Sending...' : 'Send code'}
                      </button>
                    ) : (
                      <>
                        <div className={styles.verificationHeader}>
                          <label className={styles.phoneLabel}>Verification code</label>
                          <button
                            className={styles.resendButton}
                            type="button"
                            onClick={() => {
                              setOtpCode('');
                              handleSendOtp();
                            }}
                            disabled={phoneSubmitting}
                          >
                            Resend
                          </button>
                        </div>
                        <input
                          className={styles.phoneInput}
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          disabled={phoneSubmitting}
                        />
                        <button
                          className={styles.primaryActionButton}
                          onClick={handleVerifyOtp}
                          disabled={phoneSubmitting}
                        >
                          {phoneSubmitting ? 'Verifying...' : 'Verify'}
                        </button>
                      </>
                    )}

                    {phoneError && (
                      <div className={styles.modalError}>{phoneError}</div>
                    )}

                    <button
                      className={styles.linkButton}
                      type="button"
                      onClick={() => setQueueModalStep('whatsapp')}
                      disabled={phoneSubmitting}
                    >
                      Back
                    </button>
                  </div>
                </>
              )}
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