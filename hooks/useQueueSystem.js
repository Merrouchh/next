import { useCallback, useEffect, useRef, useState } from 'react';

export const useQueueSystem = (user, supabase, modalSetters = {}) => {
  const {
    setErrorMessage = () => {},
    setShowErrorModal = () => {},
    setSuccessMessage = () => {},
    setShowSuccessModal = () => {},
    setConfirmMessage = () => {},
    setShowConfirmModal = () => {},
    setConfirmAction = () => {}
  } = modalSetters;

  const [queueStatus, setQueueStatus] = useState({
    is_active: false,
    allow_online_joining: true, // Default to true to show button initially
    current_queue_size: 0,
  });
  const [queueEntries, setQueueEntries] = useState([]);
  const [userInQueue, setUserInQueue] = useState(null);
  const [isJoiningQueue, setIsJoiningQueue] = useState(false); // Prevent race conditions
  const refreshTimeoutRef = useRef(null);

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

        setQueueStatus(safeStatus);

        // Keep the full queue list for UI decisions (ex: "am I #1 for top/bottom?")
        setQueueEntries(Array.isArray(data.queue) ? data.queue : []);

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
      // Keep a safe default on error
      setQueueStatus({
        is_active: false,
        allow_online_joining: true,
        current_queue_size: 0,
      });
      setQueueEntries([]);
    }
  }, [user]);

  const scheduleQueueRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      fetchQueueStatus();
    }, 400);
  }, [fetchQueueStatus]);

  // Set up real-time subscriptions and polling
  useEffect(() => {
    if (!user || !supabase) return;

    fetchQueueStatus();

    // Set up real-time subscription for queue changes (debounced)
    const queueSubscription = supabase
      .channel('queue-changes-users')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'computer_queue'
      }, (payload) => {
        console.log('Queue data changed:', payload);
        scheduleQueueRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'queue_settings'
      }, (payload) => {
        console.log('Queue settings changed:', payload);
        scheduleQueueRefresh();
      })
      .subscribe();

    // Backup polling every 60 seconds since we have real-time updates
    const queueInterval = setInterval(fetchQueueStatus, 60000);

    return () => {
      queueSubscription.unsubscribe();
      clearInterval(queueInterval);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [user, supabase, fetchQueueStatus, scheduleQueueRefresh]);

  const joinQueue = async (computerType = 'any', notifyWhatsapp = true) => {
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
          queueData: { computer_type: computerType, notifyWhatsapp }
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
    queueEntries,
    userInQueue,
    fetchQueueStatus,
    joinQueue,
    leaveQueue,
    isJoiningQueue
  };
};


