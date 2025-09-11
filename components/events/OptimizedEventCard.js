import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { 
  EventCardImage, 
  EventCardContent, 
  EventCardMeta, 
  RegistrationButton,
  isIOS,
  safeNavigate
} from './EventsPageComponents';
import styles from '../../styles/Events.module.css';

// Optimized EventCard component with performance improvements
const OptimizedEventCard = React.memo(({ event }) => {
  const { user, supabase, session } = useAuth();
  const router = useRouter();
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isPublicView = !user;
  const { openLoginModal } = useModal();
  
  // Add timeout ref to track navigation timeout
  const navigationTimeoutRef = useRef(null);
  // Add ref to track last log key to prevent excessive logging - UNUSED
  // const lastLogKeyRef = useRef(null);
  // Add ref to track registration check status to prevent race conditions
  const isCheckingRef = useRef(false);
  
  // Extract registration count from event
  const registeredCount = event.registered_count || 0;
  
  // Cleanup function to reset loading state - memoized
  const resetLoadingState = useCallback(() => {
    setIsLoading(false);
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
  }, []);
  
  // Cleanup effect to reset loading state when component unmounts or event changes
  useEffect(() => {
    return () => {
      isCheckingRef.current = false;
      resetLoadingState();
    };
  }, [event.id, resetLoadingState]);
  
  // Add router event listener to reset loading state on successful navigation
  useEffect(() => {
    const handleRouteChangeComplete = () => {
      resetLoadingState();
    };
    
    const handleRouteChangeError = () => {
      resetLoadingState();
    };
    
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);
    
    return () => {
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router.events, resetLoadingState]);
  
  // Registration status check - optimized with better error handling and session retry
  useEffect(() => {
    // Don't run the check for non-authenticated users
    if (!user || !event) {
      isCheckingRef.current = false;
      setCheckingRegistration(false);
      setIsRegistered(false);
      return;
    }
    
    // Don't check registration status for completed events
    if (event.status === 'Completed') {
      isCheckingRef.current = false;
      setCheckingRegistration(false);
      return;
    }
    
    // Wait for supabase context to be ready
    if (!supabase) {
      return;
    }
    
    // Use ref to track if check is already in progress to prevent duplicates
    const checkRegistrationStatus = async () => {
      // Check if already checking using ref to avoid infinite loops
      if (isCheckingRef.current) {
        return;
      }
      
      try {
        isCheckingRef.current = true;
        setCheckingRegistration(true);
        
        // Wait for session to be available - retry up to 3 times with shorter intervals
        let accessToken = session?.access_token;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!accessToken && retryCount < maxRetries) {
          // Only log on first attempt to reduce console spam
          if (retryCount === 0) {
            console.log(`[Event ${event.id}] Checking registration status...`);
          }
          
          // Wait a bit and try to get the session again
          await new Promise(resolve => setTimeout(resolve, 300));
          
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            accessToken = sessionData?.session?.access_token;
          } catch (sessionError) {
            console.error(`[Event ${event.id}] Session fetch error:`, sessionError);
          }
          
          retryCount++;
        }
        
        if (!accessToken) {
          console.log(`[Event ${event.id}] No access token available after ${maxRetries} retries`);
          isCheckingRef.current = false;
          setCheckingRegistration(false);
          setIsRegistered(false);
          return;
        }
        
        const response = await fetch('/api/internal/event-operations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'get-registration-status',
            userId: user.id,
            eventId: event.id
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.result) {
            setIsRegistered(result.result.isRegistered || false);
          } else {
            setIsRegistered(false);
          }
        } else {
          console.error(`[Event ${event.id}] Registration status check failed:`, response.status);
          setIsRegistered(false);
        }
      } catch (error) {
        console.error(`[Event ${event.id}] Error checking registration status:`, error);
        setIsRegistered(false);
      } finally {
        isCheckingRef.current = false;
        setCheckingRegistration(false);
      }
    };
    
    // Add a delay to ensure authentication context is fully loaded
    const timeoutId = setTimeout(() => {
      checkRegistrationStatus();
    }, 800); // Increased delay to prevent rapid fire calls
    
    return () => {
      clearTimeout(timeoutId);
      isCheckingRef.current = false;
    };
  }, [user, event?.id, session?.access_token, supabase, event?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Handle registration button click - memoized
  const handleRegisterClick = useCallback(() => {
    // If already registered, don't do anything
    if (isRegistered) {
      return;
    }
    
    // For public users (not logged in) on upcoming events, open login modal
    if (isPublicView && event.status === 'Upcoming') {
      openLoginModal();
      return;
    }
    
    // Show loading animation
    setIsLoading(true);
    
    // For upcoming events, navigate to the event detail page
    safeNavigate(router, `/events/${event.id}`);
  }, [isRegistered, isPublicView, event.status, event.id, openLoginModal, router]);
  
  // Handle card click to view event details - memoized
  const viewEventDetails = useCallback(() => {
    if (isLoading) return; // Prevent multiple clicks
    
    setIsLoading(true); // Set loading state to true
    
    // Set a timeout to reset loading state if navigation takes too long (iOS safety)
    navigationTimeoutRef.current = setTimeout(() => {
      resetLoadingState();
    }, isIOS() ? 2000 : 3000); // Shorter timeout for iOS devices
    
    // Attempt navigation using safe navigation utility
    safeNavigate(router, `/events/${event.id}`).catch(() => {
      resetLoadingState();
    });
  }, [isLoading, event.id, resetLoadingState, router]);

  return (
    <div 
      className={`${styles.eventCard} ${styles.clickableCard} ${isLoading ? styles.eventCardLoading : ''}`}
      onClick={viewEventDetails}
      onTouchStart={(e) => {
        // Prevent double-tap zoom on iOS
        if (isIOS()) {
          e.preventDefault();
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          viewEventDetails();
        }
      }}
    >
      {isLoading && (
        <div className={styles.eventCardLoadingOverlay}>
          <div className={styles.eventCardLoadingSpinner}></div>
        </div>
      )}
      
      <EventCardImage 
        event={event} 
        isRegistered={isRegistered} 
        registeredCount={registeredCount} 
      />
      
      <EventCardContent event={event} />
      
      <EventCardMeta event={event} registeredCount={registeredCount} />

      {/* Event actions with stopPropagation to prevent triggering the card click */}
      <div className={styles.eventActions} onClick={(e) => e.stopPropagation()}>
        <RegistrationButton
          event={event}
          isRegistered={isRegistered}
          checkingRegistration={checkingRegistration}
          registeredCount={registeredCount}
          isPublicView={isPublicView}
          isLoading={isLoading}
          onClick={(e) => {
            e.stopPropagation();
            setIsLoading(true); // Show loading animation
            handleRegisterClick();
          }}
        />
      </div>
    </div>
  );
});

OptimizedEventCard.displayName = 'OptimizedEventCard';

export default OptimizedEventCard; 