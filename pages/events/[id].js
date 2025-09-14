import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import Head from 'next/head'; // Removed unused import
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { FaImage } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import EventGallery from '../../components/EventGallery';
import React from 'react';
// DynamicMeta removed - metadata now handled in _document.js
import MobileTeamModal from '../../components/MobileTeamModal';
import DesktopTeamModal from '../../components/DesktopTeamModal';
import CancelRegistrationModal from '../../components/CancelRegistrationModal';
import {
  EventHeader,
  EventDescription,
  EventActions,
  RegistrationInfo,
  RegistrationInfoLoading,
  AdminSection,
  AdaptiveLoader
} from '../../components/events';
import {
  isIOS,
  formatDate,
  formatTime,
  retryGetSession,
  // getRegistrationButtonText, // Removed unused import
  // getRegistrationButtonClass, // Removed unused import
  // isRegistrationButtonDisabled, // Removed unused import
  validateTeamSelection,
  // generateDuoTeamName, // Removed unused import
  handleTeamMemberSelection as handleTeamMemberSelectionUtil,
  createInitialRegistrationStatus,
  // createAuthHeaders // Removed unused import
} from '../../utils/eventDetailHelpers';
import { handleError } from '../../utils/errorHandlers';

// Memoize EventGallery component to prevent re-renders
const MemoizedEventGallery = React.memo(EventGallery);

export async function getServerSideProps({ params, res }) {
  const { id } = params;
  
  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Metadata now handled in _document.js
  
  try {
    // Try fetching event data for SEO
    let event = null;
    
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
    
    // Try with absolute URL first
    const baseUrl = process.env.BASE_URL || 'https://merrouchgaming.com';
    let result = await fetchWithErrorHandling(`${baseUrl}/api/events/${id}`);
    
    // If that fails, try with relative URL
    if (!result.success) {
      result = await fetchWithErrorHandling(`/api/events/${id}`, {
        headers: { 'x-forwarded-host': 'localhost:3000' }
      });
    }
    
    // If both fail, return not found
    if (!result.success) {
      return { props: { /* Server-side metadata now handled in _document.js */ } };
    }
    
    // Extract event data
    event = result.data.event || result.data;
    
    // For completed events, try to fetch bracket data to find champion
    let champion = null;
    let hasWinner = false;
    
    if (event.status === 'Completed') {
      // Try to fetch bracket data
      let bracketResult = await fetchWithErrorHandling(`${baseUrl}/api/events/${id}/bracket`);
      
      // If that fails, try relative URL
      if (!bracketResult.success) {
        bracketResult = await fetchWithErrorHandling(`/api/events/${id}/bracket`, {
          headers: { 'x-forwarded-host': 'localhost:3000' }
        });
      }
      
      // If successful, check for a winner
      if (bracketResult.success) {
        const bracketData = bracketResult.data;
        console.log('[SSR] Champion detection - Bracket data:', bracketData);
        
        if (bracketData.bracket && bracketData.participants && bracketData.bracket.length > 0) {
          const finalRound = bracketData.bracket[bracketData.bracket.length - 1];
          console.log('[SSR] Champion detection - Final round:', finalRound);
          console.log('[SSR] Champion detection - Participants:', bracketData.participants);
          
          if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
            console.log('[SSR] Champion detection - Winner ID found:', finalRound[0].winnerId);
            hasWinner = true;
            
            // Try multiple lookup methods in order of likelihood
            champion = bracketData.participants.find(p => p.userId === finalRound[0].winnerId);
            if (!champion) {
              champion = bracketData.participants.find(p => p.user_id === finalRound[0].winnerId);
            }
            if (!champion) {
              champion = bracketData.participants.find(p => p.id === finalRound[0].winnerId);
            }
            if (!champion) {
              champion = bracketData.participants.find(p => p.registration_id === finalRound[0].winnerId);
            }
            
            console.log('[SSR] Champion detection - Champion found:', champion);
          } else {
            console.log('[SSR] Champion detection - No winner found in final round');
          }
        }
      }
    }
    
    // Try to fetch gallery images for SEO
    let galleryImages = [];
    try {
      const galleryResult = await fetchWithErrorHandling(`${baseUrl}/api/events/gallery?eventId=${id}`);
      
      // If that fails, try with relative URL
      if (!galleryResult.success) {
        const relativeGalleryResult = await fetchWithErrorHandling(`/api/events/gallery?eventId=${id}`, {
          headers: { 'x-forwarded-host': 'localhost:3000' }
        });
        
        if (relativeGalleryResult.success) {
          galleryImages = relativeGalleryResult.data.images || [];
        }
      } else {
        galleryImages = galleryResult.data.images || [];
      }
    } catch (error) {
      console.error('Error fetching gallery images for SEO:', error);
      // Continue without gallery images if there's an error
    }
    
    // Format date for description
    const formattedDate = event.date ? formatDate(event.date) : 'TBD';
    
    // Generate basic metadata
    let title = `${event.title} | Gaming Event | Merrouch Gaming`;
    let description = `${event.status} gaming ${event.team_type} tournament: ${event.game || 'Gaming'} on ${formattedDate}. ${event.description ? event.description.substring(0, 150) + '...' : 'Join our gaming event!'}`;
    let ogTitle = `${event.title} | Gaming Tournament`;
    let ogDescription = `${event.status} ${event.team_type} tournament for ${event.game || 'gamers'} on ${formattedDate} at ${event.time || 'TBD'}. ${event.description ? event.description.substring(0, 100) + '...' : ''}`;
    
    // Enhance metadata for completed events with champion information
    if (event.status === 'Completed' && hasWinner && champion) {
      if (event.team_type === 'duo' && champion.members && champion.members.length > 0) {
        // For duo events, include both team members
        const partnerName = champion.members[0]?.name || '';
        title = `${champion.name} & ${partnerName} Won ${event.title} | Merrouch Gaming`;
        description = `${champion.name} & ${partnerName} won this ${event.game || 'gaming'} duo tournament on ${formattedDate}. Check out the complete bracket and results.`;
        ogTitle = `${champion.name} & ${partnerName} Won ${event.title}`;
        ogDescription = `${champion.name} & ${partnerName} claimed victory in this ${event.game || 'gaming'} duo tournament at Merrouch Gaming Center. View the full tournament results.`;
      } else {
        // For solo events
        title = `${champion.name} Won ${event.title} | Merrouch Gaming`;
        description = `${champion.name} won this ${event.game || 'gaming'} tournament on ${formattedDate}. Check out the complete bracket and results.`;
        ogTitle = `${champion.name} Won ${event.title}`;
        ogDescription = `${champion.name} claimed victory in this ${event.game || 'gaming'} tournament at Merrouch Gaming Center. View the full tournament results.`;
      }
    }
    
    // Ensure image is a valid absolute URL
    const imageUrl = event.image && (event.image.startsWith('http') 
      ? event.image 
      : `${baseUrl}${event.image.startsWith('/') ? '' : '/'}${event.image}`);
    
    // Create full metadata object
    const metadata = {
      title,
      description,
      image: imageUrl || "https://merrouchgaming.com/events.jpg",
      url: `https://merrouchgaming.com/events/${id}`,
      type: "event",
      canonical: `https://merrouchgaming.com/events/${id}`,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        images: [
          {
            url: imageUrl || "https://merrouchgaming.com/events.jpg",
            width: 1200,
            height: 630,
            alt: `${event.title} - Gaming Tournament`,
            primary: true
          }
        ],
        site_name: "Merrouch Gaming",
        type: "event",
        locale: "en_US"
      },
      twitter: {
        card: "summary_large_image",
        site: "@merrouchgaming",
        title: ogTitle,
        description: ogDescription,
        image: imageUrl || "https://merrouchgaming.com/events.jpg",
      },
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Event",
        "@id": `https://merrouchgaming.com/events/${id}#event`,
        "name": event.title,
        "description": event.description || `${event.game || 'Gaming'} tournament at Merrouch Gaming Center`,
        "startDate": event.date,
        "endDate": event.date,
        "eventStatus": event.status === "Upcoming" ? "https://schema.org/EventScheduled" : 
                       event.status === "In Progress" ? "https://schema.org/EventInProgress" : 
                       "https://schema.org/EventCompleted",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": event.location || "Merrouch Gaming Center",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Tangier",
            "addressCountry": "MA"
          }
        },
        "image": [
          imageUrl || "https://merrouchgaming.com/events.jpg"
        ],
        "organizer": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "url": "https://merrouchgaming.com"
        },
        "offers": {
          "@type": "Offer",
          "availability": event.status === "Upcoming" && 
                         (event.registration_limit === null || 
                          event.registered_count < event.registration_limit) ? 
                         "https://schema.org/InStock" : 
                         "https://schema.org/SoldOut",
          "url": `https://merrouchgaming.com/events/${id}`,
          "price": "0",
          "priceCurrency": "MAD"
        },
        // Add a source comment to help debugging
        "source": "event-id-page"
      }
    };
    
    // Add champion information to structured data if available
    if (hasWinner && champion) {
      if (event.team_type === 'duo' && champion.members && champion.members.length > 0) {
        metadata.structuredData.performer = {
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
        metadata.structuredData.performer = {
          "@type": "Person",
          "name": champion.name
        };
      }
    }
    
    // Add gallery images to structured data if available
    if (galleryImages && galleryImages.length > 0) {
      // Enhance the event with associated media
      const allImageUrls = galleryImages.map(img => {
        // Make sure image URLs are absolute
        return img.image_url.startsWith('http') 
          ? img.image_url 
          : `${baseUrl}${img.image_url.startsWith('/') ? '' : '/'}${img.image_url}`;
      });
      
      // Add all gallery images to the main image array in structured data
      metadata.structuredData.image = [...metadata.structuredData.image, ...allImageUrls];
      
      // DO NOT create any secondary structured data objects - they cause validation errors
      // ONLY keep the main Event structured data which is valid
      
      // First, ensure we're using the latest primary image URL based on data we just set
      const mainEventImage = metadata.image;
      
      // Additional safeguard - set main image again to ensure high priority
      metadata.image = mainEventImage;
      
      // Ensure Twitter card explicitly uses the primary event image
      if (metadata.twitter) {
        metadata.twitter.image = mainEventImage;
      }
      
      // Add flag to help metadata component prioritize main event image
      metadata.prioritizeMainImage = true;
      
      // Add gallery images to OpenGraph for better social sharing - AFTER primary event image
      galleryImages.slice(0, 4).forEach(img => {
        const imgUrl = img.image_url.startsWith('http') 
          ? img.image_url 
          : `${baseUrl}${img.image_url.startsWith('/') ? '' : '/'}${img.image_url}`;
        
        metadata.openGraph.images.push({
          url: imgUrl,
          width: 1200,
          height: 800,
          alt: img.caption || `${event.title} - Gaming event image`,
          primary: false
        });
      });
    }
    
    // Add flag to prevent duplicate structured data at the app level
    metadata.excludeFromAppSeo = true;
    
    return { 
      props: { 
        champion: champion || null,
        hasWinner: hasWinner || false,
        /* Server-side metadata now handled in _document.js */ 
      } 
    };
  } catch (error) {
    console.error('Error fetching event for SEO:', error);
    return { 
      props: { 
        champion: null,
        hasWinner: false,
        /* Server-side metadata now handled in _document.js */ 
      } 
    };
  }
}

export default function EventDetail() {
  // Core state
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState(createInitialRegistrationStatus());
  
  // Team management state - consolidated
  const [teamState, setTeamState] = useState({
    selectedMembers: [],
    teamType: 'solo',
    teamName: '',
    registrationNotes: '',
    searchQuery: ''
  });
  
  // Modal state - consolidated
  const [modalState, setModalState] = useState({
    isTeamModalOpen: false,
    isCancelModalOpen: false,
    modalStep: 1, // For mobile step-by-step flow
    isMobile: false
  });
  
  // Bracket state - consolidated
  const [bracketState, setBracketState] = useState({
    data: null,
    loading: false
  });
  
  // Error state
  
  // Refs
  const searchInputRef = useRef(null);
  const eventId = useRef(null);
  
  // Router and context
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase, session } = useAuth();
  const { openLoginModal } = useModal();

  // Check if we're on mobile - optimized with debouncing
  useEffect(() => {
    let timeoutId = null;
    
    const checkIfMobile = () => {
      const isMobile = window.innerWidth < 768;
      setModalState(prev => {
        // Only update if the value actually changed
        if (prev.isMobile !== isMobile) {
          return { ...prev, isMobile };
        }
        return prev;
      });
    };
    
    const debouncedCheckIfMobile = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkIfMobile, 150); // Debounce resize events
    };
    
    // Initial check
    checkIfMobile();
    
    // Listen for resize events with debouncing
    window.addEventListener('resize', debouncedCheckIfMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', debouncedCheckIfMobile);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Reset modal step when modal opens/closes
  useEffect(() => {
    if (modalState.isTeamModalOpen) {
      setModalState(prev => ({ ...prev, modalStep: 1 }));
      // Prevent scrolling on body when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      // Re-enable scrolling when modal is closed
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    
    // Cleanup function to ensure scrolling is re-enabled if component unmounts
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [modalState.isTeamModalOpen]);
  
  // Store event ID in ref to prevent re-renders
  if (event && event.id !== eventId.current) {
    eventId.current = event.id;
  }

  // Determine if this is a public view (no authenticated user)
  const isPublicView = !user;

  // Memoize the old device detection to avoid recalculating
  const isOldDevice = useMemo(() => {
    try {
      return isIOS() && /OS [5-9]_/.test(navigator.userAgent);
    } catch (error) {
      // Fallback for very old devices that might not support navigator properly
      console.log('Device detection error, assuming old device:', error);
      return true;
    }
  }, []);

  // Function to fetch the latest registration count - memoized
  const fetchLatestCount = useCallback(async () => {
    if (!event || !supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('events')
        .select('registered_count, registration_limit')
        .eq('id', event.id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setRegistrationStatus(prev => ({
          ...prev,
          registeredCount: data.registered_count || 0,
          registrationLimit: data.registration_limit
        }));
      }
          } catch (error) {
        handleError(error, {
          context: 'Fetch Latest Registration Count',
          showToast: false // Don't show toast for background updates
        });
      }
  }, [event, supabase]);

  // Function to fetch bracket data
  const fetchBracketData = useCallback(async (accessToken) => {
    if (!id) return;
    
    setBracketState(prev => ({ ...prev, loading: true }));
    
    try {
      if (!accessToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.access_token) {
          throw new Error('Authentication token not available');
        }
        
        accessToken = sessionData.session.access_token;
      }
      
      console.log(`[Event Detail ${id}] Fetching bracket data for eventId: ${id}, userId: ${user?.id || 'public'}`);
      
      const response = await fetch('/api/internal/event-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get-bracket',
          userId: user?.id || null,
          eventId: id
        })
      });
      
      console.log(`[Event Detail ${id}] Bracket API response status:`, response.status);
      
      // If 404, it means no bracket exists yet, which is not an error
      if (response.status === 404) {
        console.log(`[Event Detail ${id}] No bracket found for event`);
        setBracketState({ data: null, loading: false });
        return;
      }
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          console.error('Bracket API non-JSON response:', response.status, response.statusText);
          throw new Error(`Failed to fetch bracket data: ${response.status} - ${response.statusText}`);
        }
        console.error('Bracket API error:', errorData);
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      
      if (data && data.bracket) {
        setBracketState({ data, loading: false });
      } else {
        setBracketState({ data: null, loading: false });
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      setBracketState({ data: null, loading: false });
      throw error; // Re-throw the error so the caller can handle it
    }
  }, [id, supabase, user?.id]);

  // Function to fetch public bracket data
  const fetchPublicBracketData = useCallback(async () => {
    if (!id) return;
    
    setBracketState(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // If 404, it means no bracket exists yet, which is not an error
      if (response.status === 404) {
        setBracketState({ data: null, loading: false });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        setBracketState({ data, loading: false });
      } else {
        setBracketState({ data: null, loading: false });
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);  
      setBracketState({ data: null, loading: false });
      throw error;
    }
  }, [id]);

  // Fetch registration status
  const fetchRegistrationStatus = useCallback(async (accessToken) => {
    try {
      console.log(`[Event Detail ${id}] Starting registration status check...`);
      
      // Wait for session to be available - retry up to 3 times with shorter intervals
      let tokenToUse = accessToken;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!tokenToUse && retryCount < maxRetries) {
        console.log(`[Event Detail ${id}] Waiting for session... attempt ${retryCount + 1}/${maxRetries}`);
        
        // Wait a bit and try to get the session again
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          tokenToUse = sessionData?.session?.access_token;
        } catch (sessionError) {
          console.error(`[Event Detail ${id}] Session fetch error:`, sessionError);
        }
        
        retryCount++;
      }
      
      // Check if we have a valid access token
      if (!tokenToUse) {
        console.log(`[Event Detail ${id}] No access token available after ${maxRetries} retries - user may not be authenticated`);
        setRegistrationStatus(prev => ({
          ...prev,
          isLoading: false,
          isRegistered: false
        }));
        return false;
      }
      
      console.log(`[Event Detail ${id}] Access token obtained, checking registration status...`);
      
      const response = await fetch('/api/internal/event-operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get-registration-status',
          userId: user?.id || null,
          eventId: id
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Event Detail ${id}] API Error (${response.status}):`, errorText);
        
        // Always clear loading state on error
        setRegistrationStatus(prev => ({
          ...prev,
          isLoading: false
        }));
        
        throw new Error(`Failed to fetch registration status: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to get registration status');
      }
      const data = result; // The API returns data directly, not in a 'result' field
      console.log(`[Event Detail ${id}] Registration status response:`, data);
      console.log(`[Event Detail ${id}] Partner info:`, data.partnerInfo);
      
        // Update team type from event data if available
        if (data.eventData && data.eventData.team_type) {
          setTeamState(prev => ({ ...prev, teamType: data.eventData.team_type }));
        }
      
      // Update registration status - ensure registeredBy is handled properly
      setRegistrationStatus({
        isRegistered: data.isRegistered,
        isLoading: false,
        registeredCount: data.eventData?.registered_count || 0,
        registrationLimit: data.eventData?.registration_limit || null,
        teamMembers: data.teamMembers || [],
        availableTeamMembers: data.availableTeamMembers || [],
        // Ensure registeredBy is null if user is the main registrant
        registeredBy: data.registeredBy || null,
        // Add partner information for duo events
        partnerInfo: data.partnerInfo || null
      });
      
      console.log(`[Event Detail ${id}] Registration status updated - isRegistered: ${data.isRegistered}, registeredBy: ${data.registeredBy || 'NULL'}`);
      
      return data.isRegistered;
    } catch (error) {
      console.error(`[Event Detail ${id}] Error fetching registration status:`, error);
      
      // Always clear loading state on error
      setRegistrationStatus(prev => ({
        ...prev,
        isLoading: false
      }));
      
      return false;
    }
  }, [id, supabase, user?.id]);

  const closeTeamModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isTeamModalOpen: false }));
    setTeamState(prev => ({ ...prev, searchQuery: '' }));
  }, []);

  // Handle registration
  const handleRegistration = useCallback(async () => {
    if (registrationStatus.isLoading) return;
    
    setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Use the retry session utility
      const accessToken = await retryGetSession(supabase);
      
      if (!accessToken) {
        toast.error('Authentication token not available - please try logging out and back in');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // Validate team selection using the utility function
      const validationError = validateTeamSelection(teamState.teamType, teamState.selectedMembers, teamState.teamName);
      if (validationError) {
        toast.error(validationError);
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
        
      // Prepare API call
      const response = await fetch('/api/internal/event-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'register',
          userId: user?.id || null,
          eventId: id,
          registrationData: {
            teamMembers: teamState.selectedMembers,
            notes: teamState.registrationNotes,
            teamName: teamState.teamName.trim() || (teamState.teamType === 'duo' && teamState.selectedMembers.length === 1 ? 
            `${user.username || 'You'} & ${teamState.selectedMembers[0].username}` : '') // Auto-generate team name for duo events if not provided
          }
        })
      });
        
        const result = await response.json();
        
        if (!response.ok) {
        // Display error as toast instead of throwing an error
        toast.error(result.error || 'Registration failed');
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        if (!result.success) {
          toast.error(result.error || 'Registration failed');
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        // Success!
        toast.success(result.message || 'Registered for event successfully');
      
      // Reset form fields
      setTeamState(prev => ({
        ...prev,
        selectedMembers: [],
        registrationNotes: '',
        teamName: ''
      }));
      
      // Close the modal
      closeTeamModal();
        
        // Refresh registration status to get team members
        await fetchRegistrationStatus(accessToken);
    } catch (error) {
      handleError(error, {
        context: 'Handle Registration',
        onError: () => setRegistrationStatus(prev => ({ ...prev, isLoading: false }))
      });
    }
  }, [registrationStatus.isLoading, supabase, teamState.teamType, teamState.selectedMembers, teamState.teamName, teamState.registrationNotes, id, user, closeTeamModal, fetchRegistrationStatus]);

  // Fetch event details - only when id changes
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!id) return;
      
      setLoading(true);
      // Ensure registration shows a loading state during initial page load for all users
      setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
      
      try {
        // For old devices, use simpler approach
        if (isOldDevice) {
          console.log('Old device detected, using simplified loading');
          
          // Simpler fetch for old devices
          const response = await fetch(`/api/events/${id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.status === 404) {
            // Deleted or missing event - show Not Found gracefully
            setEvent(null);
            setLoading(false);
            setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
            setBracketState({ data: null, loading: false });
            return;
          }

          if (!response.ok) {
            // Best-effort parse of error; fall back to status text
            let message = `Failed to fetch event: ${response.status}`;
            try {
              const err = await response.json();
              message = err?.error || message;
            } catch {}
            throw new Error(message);
          }
          
          const data = await response.json();
          const eventData = data.event || data;
          
          if (!eventData) {
            throw new Error("Invalid event data format");
          }
          
          setEvent(eventData);
          console.log('Event data loaded (old device), setting loading to false');
          setLoading(false);
          
          // For old devices, skip complex auth operations and just show basic event info
          setRegistrationStatus(prev => ({
            ...prev,
            isLoading: false,
            registeredCount: eventData.registered_count || 0,
            registrationLimit: eventData.registration_limit
          }));
          
          // Simple bracket fetch for old devices
          try {
            const bracketResponse = await fetch(`/api/events/${id}/bracket`);
            if (bracketResponse.ok) {
              const bracketData = await bracketResponse.json();
              setBracketState({ data: bracketData, loading: false });
            } else {
              setBracketState({ data: null, loading: false });
            }
          } catch (bracketError) {
            console.log('Bracket fetch failed for old device:', bracketError);
            setBracketState({ data: null, loading: false });
          }
          
          return; // Exit early for old devices
        }
        
        // Modern device logic (original code)
        // Fetch event details (public endpoint, no auth needed)
        const response = await fetch(`/api/events/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 404) {
          // Deleted or missing event - show Not Found gracefully
          setEvent(null);
          setLoading(false);
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          setBracketState({ data: null, loading: false });
          return;
        }

        if (!response.ok) {
          // Best-effort parse of error; fall back to status text
          let message = `Failed to fetch event: ${response.status}`;
          try {
            const err = await response.json();
            message = err?.error || message;
          } catch {}
          throw new Error(message);
        }
        
        const data = await response.json();
        
        // Handle both formats: { event: {...} } or the event object directly
        const eventData = data.event || data;
        
        if (!eventData) {
          throw new Error("Invalid event data format");
        }
        
        setEvent(eventData);
        
        // Set loading to false after event data is fetched
        console.log('Event data loaded, setting loading to false');
        setLoading(false);
      } catch (error) {
        console.error('Event fetch error:', error);
        handleError(error, {
          context: 'Fetch Event Details',
          onError: () => setLoading(false)
        });
      }
    };
    
    fetchEventDetails();
  }, [id, isOldDevice]); // Only depend on id and isOldDevice
  
  // Handle user-dependent data fetching separately
  useEffect(() => {
    if (!event || !id) return; // Wait for event data to be loaded first
    
    if (user && supabase) {
      console.log(`[Event Detail ${id}] User authenticated, fetching registration status...`);
      
      // Always fetch registration status when user is logged in
      setTimeout(() => {
        fetchRegistrationStatus(session?.access_token).catch(error => {
          handleError(error, {
            context: 'Fetch Registration Status',
            showToast: false
          });
        });
      }, 100);
      
      // Try to fetch bracket data
      setTimeout(() => {
        fetchBracketData(session?.access_token).catch(error => {
          handleError(error, {
            context: 'Fetch Bracket Data',
            showToast: false,
            onError: () => setBracketState({ data: null, loading: false })
          });
        });
      }, 200);
    } else {
      // For unauthenticated users, try to fetch public bracket data
      fetchPublicBracketData().catch(error => {
        handleError(error, {
          context: 'Fetch Public Bracket Data',
          showToast: false,
          onError: () => setBracketState({ data: null, loading: false })
        });
      });
      
      // Also fetch the latest count for unauthenticated users
      fetchLatestCount();
      
      // Set a timeout to show the loading animation for a moment before hiding
      setTimeout(() => {
        setRegistrationStatus(prev => ({
          ...prev,
          isLoading: false
        }));
      }, 1500);
    }
  }, [event, user, supabase, session, id, fetchRegistrationStatus, fetchBracketData, fetchPublicBracketData, fetchLatestCount]);
  
  // When the user state changes, update registration loading state
  useEffect(() => {
    // Keep loading state active initially for all users, whether authenticated or not
    // It will be updated after the event data loads and registeredCount is available
    if (!user) {
      // Only reset loading state if event data is already loaded (avoid race condition)
      if (event) {
        setTimeout(() => {
          setRegistrationStatus(prev => ({
            ...prev,
            isLoading: false
          }));
        }, 1000); // Add a small delay to make the animation visible
      }
    }
  }, [user, event]);

  // Set up real-time subscription for registration updates - optimized
  useEffect(() => {
    if (!event?.id || !supabase) return;
    
    // const eventId = event.id; // Removed unused variable
    
    // For old devices, skip real-time subscriptions and just use polling
    if (isOldDevice) {
      console.log('Old device: Skipping real-time subscriptions, using polling only');
      
      // Fetch initial count
      fetchLatestCount();
      
      // Use more frequent polling for old devices since no real-time
      const intervalId = setInterval(fetchLatestCount, 15000); // Every 15 seconds
      
      return () => {
        clearInterval(intervalId);
      };
    }
    
    // Modern device logic with real-time subscriptions - UNUSED
    // try {
    //   // Subscribe to changes in the event_registrations table
    //   const channel = supabase
    //     .channel(`event-${eventId}`)
    //     .on(
    //       'postgres_changes',
    //       {
    //         event: 'INSERT',
    //         schema: 'public',
    //         table: 'event_registrations',
    //         filter: `event_id=eq.${eventId}`
    //       },
    //       (payload) => {
    //         fetchLatestCount();
    //         toast.success('Someone just registered for this event!', { duration: 3000 });
    //       }
    //     )
    //     .on(
    //       'postgres_changes',
    //       {
    //         event: 'DELETE',
    //         schema: 'public',
    //         table: 'event_registrations',
    //         filter: `event_id=eq.${eventId}`
    //       },
    //       async (payload) => {
    //         // Fetch the latest count and updated registration status
    //         fetchLatestCount();
    //         
    //         // Also force refresh registration status for the user
    //         if (user && session?.access_token) {
    //           await fetchRegistrationStatus(session.access_token);
    //         }
    //         
    //         toast('Someone cancelled their registration', { duration: 3000 });
    //       }
    //     )
    //     // Add a more reliable way to detect unregistrations through UPDATE events
    //     .on(
    //       'postgres_changes',
    //       {
    //         event: 'UPDATE',
    //         schema: 'public',
    //         table: 'events',
    //         filter: `id=eq.${eventId}`
    //       },
    //       async (payload) => {
    //         // This will update the count if it changed
    //         fetchLatestCount();
    //         
    //         // Also refresh registration status for the user
    //         if (user && session?.access_token) {
    //           await fetchRegistrationStatus(session.access_token);
    //         }
    //       }
    //     )
    //     .subscribe();
      
      // Fetch the latest count when the component mounts
      fetchLatestCount();
      
      // Less frequent polling for modern devices since they have real-time
      const intervalId = setInterval(fetchLatestCount, 30000); // Every 30 seconds
      
      // Clean up subscription when component unmounts
      return () => {
        // supabase.channel(`event-${eventId}`).unsubscribe(); // Commented out since subscription is disabled
        clearInterval(intervalId);
      };
    // } catch (error) {
    //   console.error('Error setting up real-time subscription:', error);
    //   
    //   // Fallback to polling if real-time setup fails
    //   fetchLatestCount();
    //   const intervalId = setInterval(fetchLatestCount, 20000);
    //   
    //   return () => {
    //     clearInterval(intervalId);
    //   };
    // }
  }, [event?.id, supabase, session?.access_token, user, fetchLatestCount, isOldDevice]);
  
  
  
  // Add this function to generate a bracket (admin only)
  const handleGenerateBracket = async () => {
    if (!user?.isAdmin || !id) return;
    
    setBracketState(prev => ({ ...prev, loading: true }));
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('Authentication token not available');
      }
      
      // Generate bracket
      const response = await fetch('/api/internal/event-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate',
          userId: user?.id || null,
          eventId: id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate bracket: ${response.status}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate bracket');
      }
      const data = result.result;
      
      if (data && data.bracket) {
        setBracketState({ data, loading: false });
        toast.success('Tournament bracket generated successfully!');
      }
    } catch (error) {
      console.error('Error generating bracket:', error);
      toast.error(error.message || 'Failed to generate tournament bracket');
      setBracketState(prev => ({ ...prev, loading: false }));
    }
  };
  
  // Add this function to delete a bracket (admin only)
  const handleDeleteBracket = async () => {
    if (!user?.isAdmin || !id) return;
    
    if (!confirm('Are you sure you want to delete this tournament bracket? This action cannot be undone.')) {
      return;
    }
    
    setBracketState(prev => ({ ...prev, loading: true }));
    
    try {
      // Use the retry session utility
      const accessToken = await retryGetSession(supabase);
      
      if (!accessToken) {
        throw new Error('Authentication token not available');
      }
      
      // Delete bracket
      const response = await fetch('/api/internal/event-bracket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete-bracket',
          userId: user?.id || null,
          eventId: id
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete bracket: ${response.status}`);
      }
      
      const data = await response.json();
      
      setBracketState({ data: null, loading: false });
      toast.success(data.message || 'Tournament bracket deleted successfully!');
    } catch (error) {
      console.error('Error deleting bracket:', error);
      toast.error(error.message || 'Failed to delete tournament bracket');
      setBracketState(prev => ({ ...prev, loading: false }));
    }
  };
  
  // Filter team members based on search query
  const filteredTeamMembers = registrationStatus.availableTeamMembers.filter(member => 
    member.username.toLowerCase().includes(teamState.searchQuery.toLowerCase())
  );
  
  // Modal functions - memoized to prevent re-renders
  const openTeamModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isTeamModalOpen: true }));
    // Focus the search input after modal opens
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  }, []);
  
  
  const openCancelModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isCancelModalOpen: true }));
  }, []);
  
  const closeCancelModal = useCallback(() => {
    setModalState(prev => ({ ...prev, isCancelModalOpen: false }));
  }, []);
  
  // Handle cancel button click
  const handleCancelClick = () => {
    // We only show the cancel button for upcoming events now,
    // so we can remove the check for event status
    openCancelModal();
  };
  
  // Confirm cancellation
  const confirmCancellation = async () => {
    closeCancelModal();
    
    setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Use the retry session utility
      const accessToken = await retryGetSession(supabase);
      
      if (!accessToken) {
        toast.error('Authentication token not available - please try logging out and back in');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // Cancel registration
      const response = await fetch('/api/internal/event-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'unregister',
          userId: user?.id || null,
          eventId: id
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        // Display specific error message from API if available
        toast.error(result.error || 'Failed to cancel registration');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      if (!result.success) {
        toast.error(result.error || 'Failed to cancel registration');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      toast.success(result.message || 'Registration cancelled successfully');
      
      // Immediately update local state
      setRegistrationStatus(prev => ({
        ...prev,
        isRegistered: false,
        registeredCount: Math.max(0, prev.registeredCount - 1),
        teamMembers: []
      }));
      
      // Refresh the data to ensure consistency
      fetchLatestCount();
      
      // Force a complete refresh of the event data including registration status
      if (accessToken) {
        // Use a shorter delay for better user experience
        setTimeout(async () => {
          try {
            // This delayed refresh ensures we get the latest state from the server
            await fetchRegistrationStatus(accessToken);
          } catch (error) {
            console.error("Error in forced refresh:", error);
          }
        }, 500); // Reduced delay from 1000ms to 500ms
      }
    } catch (error) {
      handleError(error, {
        context: 'Cancel Registration',
        onError: () => setRegistrationStatus(prev => ({ ...prev, isLoading: false }))
      });
    }
  };
  
  // Handle registration button click
  const handleRegistrationClick = async () => {
    // If public user (not logged in) on upcoming event, open login modal
    if (isPublicView && event.status === 'Upcoming') {
      openLoginModal();
      return;
    }
  
    if (registrationStatus.isRegistered) {
      // If already registered, don't do anything when clicking the "Registered" button
      // The user should use the dedicated "Cancel Registration" button instead
      return;
    } else {
      // If not registered and it's a team event, open the modal
      if (teamState.teamType !== 'solo') {
        openTeamModal();
      } else {
        // For solo events, proceed with registration
        handleRegistration();
      }
    }
  };
  
  // Navigation functions - memoized to prevent re-renders
  const goToNextStep = useCallback(() => {
    setModalState(prev => ({ ...prev, modalStep: prev.modalStep + 1 }));
  }, []);
  
  const goToPrevStep = useCallback(() => {
    setModalState(prev => ({ ...prev, modalStep: Math.max(1, prev.modalStep - 1) }));
  }, []);
  
  // Complete registration function - memoized
  const completeRegistration = useCallback(() => {
    // Validate team selection using the utility function
    const validationError = validateTeamSelection(teamState.teamType, teamState.selectedMembers, teamState.teamName);
    
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    // Close the modal and proceed with registration
    closeTeamModal();
    handleRegistration();
  }, [teamState.teamType, teamState.selectedMembers, teamState.teamName, closeTeamModal, handleRegistration]);
  
  // Handle team member selection - memoized
  const handleTeamMemberSelection = useCallback((member) => {
    const setSelectedTeamMembers = (updater) => {
      if (typeof updater === 'function') {
        setTeamState(prev => ({ ...prev, selectedMembers: updater(prev.selectedMembers) }));
      } else {
        setTeamState(prev => ({ ...prev, selectedMembers: updater }));
      }
    };
    
    const setTeamName = (name) => {
      setTeamState(prev => ({ ...prev, teamName: name }));
    };
    
    handleTeamMemberSelectionUtil(
      member, 
      teamState.selectedMembers, 
      teamState.teamType, 
      user, 
      setSelectedTeamMembers, 
      setTeamName
    );
  }, [teamState.selectedMembers, teamState.teamType, user]);

  // Reset team name whenever the modal is closed - optimized
  useEffect(() => {
    if (!modalState.isTeamModalOpen) {
      setTeamState(prev => ({ ...prev, teamName: '' }));
    }
  }, [modalState.isTeamModalOpen]);
  
  
  // Use utility functions for registration button logic (isPublicView defined elsewhere)

  // Add a safety timeout to ensure loading state is reset if it gets stuck
  useEffect(() => {
    if (loading) {
      // Longer timeout to avoid premature loading state reset
      const timeoutMs = isOldDevice ? 5000 : 10000; // Increased timeouts
      const timeoutId = setTimeout(() => {
        console.log('Loading timeout reached, forcing loading to false');
        setLoading(false);
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        
        if (isOldDevice) {
          // For old devices, just show basic message without toast (toast might not work)
          console.log('Old device: Loading took too long');
        } else {
          console.log('Loading took longer than expected, but continuing...');
        }
      }, timeoutMs);
      
      return () => clearTimeout(timeoutId);
    }
  }, [loading, isOldDevice]);

  // Emergency fallback for old devices - force show content after delay
  useEffect(() => {
    if (isOldDevice && loading) {
      const emergencyTimeoutId = setTimeout(() => {
        console.log('Old device: Emergency timeout - forcing content to show');
        setLoading(false);
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        
        // If we still don't have event data, create minimal fallback
        if (!event && id) {
          setEvent({
            id: id,
            title: 'Event Details',
            description: 'Loading event information...',
            status: 'Loading',
            date: null,
            time: null,
            location: 'Merrouch Gaming Center',
            registered_count: 0,
            registration_limit: null,
            team_type: 'solo'
          });
        }
      }, 1000); // Very short timeout for old devices
      
      return () => clearTimeout(emergencyTimeoutId);
    }
  }, [isOldDevice, loading, event, id]);


  return (
    <ProtectedPageWrapper>
              {/* DynamicMeta removed - metadata now handled in _document.js */}

      <div className={styles.container}>
        <Link href="/events" className={styles.backLink}>
          &larr; Back to Events
        </Link>

        {loading ? (
          <AdaptiveLoader 
            isOldDevice={isOldDevice}
            message="Loading event details..."
          />
        ) : !event ? (
          <div className={styles.notFoundContainer}>
            <h1 className={styles.notFoundTitle}>Event Not Found</h1>
            <p>The event you&apos;re looking for doesn&apos;t exist or has been removed.</p>
            <Link href="/events" className={styles.backButton}>
              Back to Events
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.eventDetail}>
              <EventHeader 
                event={event}
                registrationStatus={registrationStatus}
                isPublicView={isPublicView}
                teamState={teamState}
                bracketState={bracketState}
                eventId={id}
              />
              
              
              <div className={styles.eventContent}>
                {/* Safe event description rendering for old devices */}
                {isOldDevice ? (
                  <div className={styles.eventDescription}>
                    <h2>Event Description</h2>
                    <p>{event.description || 'Event details will be displayed here.'}</p>
                    {event.date && <p><strong>Date:</strong> {formatDate(event.date)}</p>}
                    {event.time && <p><strong>Time:</strong> {formatTime(event.time)}</p>}
                    {event.location && <p><strong>Location:</strong> {event.location}</p>}
                  </div>
                ) : (
                  <EventDescription event={event} />
                )}
                
                <EventActions
                  event={event}
                  registrationStatus={registrationStatus}
                  isPublicView={isPublicView}
                  bracketState={bracketState}
                  onRegistrationClick={handleRegistrationClick}
                  onCancelClick={handleCancelClick}
                  onLoginClick={openLoginModal}
                />
                
                {/* Registration information - for all users */}
                <RegistrationInfo event={event} registrationStatus={registrationStatus} />
                
                {/* Loading indicator for registration info - show only during loading */}
                <RegistrationInfoLoading event={event} registrationStatus={registrationStatus} />
                
                {/* Admin section - only for admins */}
                <AdminSection
                  user={user}
                  event={event}
                  bracketState={bracketState}
                  onGenerateBracket={handleGenerateBracket}
                  onDeleteBracket={handleDeleteBracket}
                />
              </div>
            </div>
            
            {/* Event Gallery Section */}
            {event && !isOldDevice && (
              <section className={styles.gallerySection}>
                <h2 className={styles.sectionHeading}>
                  <FaImage /> Event Gallery
                </h2>
                <div className={styles.galleryContainer}>
                  {/* Use memoized component to prevent re-renders */}
                  {eventId.current && (
                    <MemoizedEventGallery 
                      key={`gallery-${eventId.current}`} 
                      eventId={eventId.current}
                      hideTitle={true}
                    />
                  )}
                </div>
              </section>
            )}
            
            {/* Simplified gallery message for old devices */}
            {event && isOldDevice && (
              <section className={styles.gallerySection}>
                <h2 className={styles.sectionHeading}>Event Gallery</h2>
                <p>Gallery is not available on this device. Please use a modern browser to view event photos.</p>
              </section>
            )}
          </>
        )}
        
        {/* Team selection modal */}
        {modalState.isTeamModalOpen && (
          <div className={styles.modalOverlay} onClick={closeTeamModal}>
            {modalState.isMobile ? (
              <MobileTeamModal
                filteredTeamMembers={filteredTeamMembers}
                selectedTeamMembers={teamState.selectedMembers}
                searchQuery={teamState.searchQuery}
                onSearchChange={e => setTeamState(prev => ({ ...prev, searchQuery: e.target.value }))}
                handleTeamMemberSelection={handleTeamMemberSelection}
                modalStep={modalState.modalStep}
                goToNextStep={goToNextStep}
                goToPrevStep={goToPrevStep}
                completeRegistration={completeRegistration}
                teamType={teamState.teamType}
                closeModal={closeTeamModal}
                teamName={teamState.teamName}
                onTeamNameChange={(name) => setTeamState(prev => ({ ...prev, teamName: name }))}
                notes={teamState.registrationNotes}
                onNotesChange={(notes) => setTeamState(prev => ({ ...prev, registrationNotes: notes }))}
                registrationStatus={registrationStatus}
                eventTitle={event?.title}
              />
            ) : (
              <DesktopTeamModal
                filteredTeamMembers={filteredTeamMembers}
                selectedTeamMembers={teamState.selectedMembers}
                searchQuery={teamState.searchQuery}
                onSearchChange={e => setTeamState(prev => ({ ...prev, searchQuery: e.target.value }))}
                handleTeamMemberSelection={handleTeamMemberSelection}
                completeRegistration={completeRegistration}
                teamType={teamState.teamType}
                closeModal={closeTeamModal}
                teamName={teamState.teamName}
                onTeamNameChange={(name) => setTeamState(prev => ({ ...prev, teamName: name }))}
                notes={teamState.registrationNotes}
                onNotesChange={(notes) => setTeamState(prev => ({ ...prev, registrationNotes: notes }))}
                registrationStatus={registrationStatus}
              />
            )}
          </div>
        )}
        
        {/* Cancellation confirmation modal */}
        {modalState.isCancelModalOpen && (
          <CancelRegistrationModal
            onClose={closeCancelModal}
            onConfirm={confirmCancellation}
            eventTitle={event?.title || 'this event'}
          />
        )}
      </div>
    </ProtectedPageWrapper>
  );
} 