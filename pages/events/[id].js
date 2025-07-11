import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { FaSearch, FaTimes, FaUserPlus, FaTrophy, FaSitemap, FaImage, FaInfo } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import EventGallery from '../../components/EventGallery';
import React from 'react';
import DynamicMeta from '../../components/DynamicMeta';
import TournamentWinner from '../../components/shared/TournamentWinner';
import MobileTeamModal from '../../components/MobileTeamModal';
import DesktopTeamModal from '../../components/DesktopTeamModal';
import CancelRegistrationModal from '../../components/CancelRegistrationModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Format date for display - moved to a utility function outside component
const formatDate = (dateString) => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
};

// Memoize EventGallery component to prevent re-renders
const MemoizedEventGallery = React.memo(EventGallery);

export async function getServerSideProps({ params, res }) {
  const { id } = params;
  
  // Set cache headers first
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );
  res.setHeader(
    'Surrogate-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );
  res.setHeader('Vary', 'Cookie, Accept-Encoding');
  
  // Default metadata for not found case
  const notFoundMetadata = {
    title: "Event Not Found | Merrouch Gaming Center",
    description: "The gaming event you're looking for doesn't exist or has been removed.",
    image: "https://merrouchgaming.com/events.jpg",
    url: `https://merrouchgaming.com/events/${id}`,
    type: "website",
    canonical: `https://merrouchgaming.com/events/${id}`
  };
  
  try {
    // Use direct Supabase connection - working perfectly now
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch event data directly from database
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return { props: { metaData: notFoundMetadata } };
    }

    // For completed events, try to fetch bracket data to find champion
    let champion = null;
    let hasWinner = false;
    
    if (event.status === 'Completed') {
      // Fetch bracket data directly
      const { data: bracketData, error: bracketError } = await supabase
        .from('event_brackets')
        .select('matches')
        .eq('event_id', id)
        .single();

      // Fetch participants directly
      const { data: participants, error: participantsError } = await supabase
        .from('event_registrations')
        .select(`
          id, 
          user_id, 
          username,
          event_team_members (
            id,
            user_id,
            username
          ),
          team_name
        `)
        .eq('event_id', id)
        .eq('status', 'registered');

      if (!bracketError && bracketData?.matches && !participantsError && participants) {
        const bracket = bracketData.matches;
        if (bracket.length > 0) {
          const finalRound = bracket[bracket.length - 1];
          if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
            hasWinner = true;
            champion = participants.find(p => p.id === finalRound[0].winnerId);
          }
        }
      }
    }

    // Try to fetch gallery images for SEO
    let galleryImages = [];
    try {
      const { data: images, error: galleryError } = await supabase
        .from('event_gallery')
        .select('*')
        .eq('event_id', id)
        .order('created_at', { ascending: false });

      if (!galleryError && images) {
        galleryImages = images;
      }
    } catch (error) {
      console.error('Error fetching gallery images for SEO:', error);
      // Continue without gallery images if there's an error
    }

    // Format date for description
    const formattedDate = event.date ? formatDate(event.date) : 'TBD';
    
    // Generate basic metadata
    let title = `${event.title} | Gaming Event | Merrouch Gaming`;
    let description = `Join the ${event.title} gaming event at Merrouch Gaming Center. `;
    
    // Add event type info
    if (event.team_type) {
      const teamTypeText = event.team_type === 'solo' ? 'solo' : 
                          event.team_type === 'duo' ? 'duo team' : 'team';
      description += `This is a ${teamTypeText} competition `;
    }
    
    // Add game info if available
    if (event.game) {
      description += `for ${event.game} `;
    }
    
    // Add date info
    description += `scheduled for ${formattedDate}. `;
    
    // Add status-specific info
    if (event.status === 'Completed' && hasWinner && champion) {
      if (event.team_type === 'duo' && champion.event_team_members && champion.event_team_members.length > 0) {
        const partner = champion.event_team_members[0];
        title = `${champion.username} & ${partner.username} Win ${event.title} | Merrouch Gaming`;
        description += `Congratulations to ${champion.username} & ${partner.username} for winning this tournament!`;
      } else if (event.team_type === 'team' && champion.team_name) {
        title = `${champion.team_name} Wins ${event.title} | Merrouch Gaming`;
        description += `Congratulations to ${champion.team_name} for winning this tournament!`;
      } else {
        title = `${champion.username} Wins ${event.title} | Merrouch Gaming`;
        description += `Congratulations to ${champion.username} for winning this tournament!`;
      }
    } else if (event.status === 'In Progress') {
      title = `${event.title} - Live Tournament | Merrouch Gaming`;
      description += `Tournament is currently in progress. Follow the action live!`;
    } else if (event.status === 'Upcoming') {
      description += `Registration is open. Don't miss out on this exciting gaming competition!`;
    }

    // OpenGraph specific content
    let ogTitle = title;
    let ogDescription = description;
    
    // Ensure image is a valid absolute URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://merrouchgaming.com';
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
        "@type": "SportsEvent",
        "name": `${event.title} Tournament`,
        "description": `Tournament for ${event.title}, a ${event.team_type} ${event.game || 'gaming'} competition.`,
        "startDate": event.date,
        "endDate": event.date,
        "eventStatus": event.status === 'Completed' ? 'https://schema.org/EventCompleted' :
                      event.status === 'In Progress' ? 'https://schema.org/EventScheduled' :
                      'https://schema.org/EventScheduled',
        "location": {
          "@type": "Place",
          "name": event.location || "Merrouch Gaming Center",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Tangier",
            "addressCountry": "MA"
          }
        },
        "image": [imageUrl || "https://merrouchgaming.com/events.jpg"],
        "organizer": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "url": "https://merrouchgaming.com"
        }
      }
    };

    // Add winner information to structured data if available
    if (hasWinner && champion) {
      if (event.team_type === 'duo' && champion.event_team_members && champion.event_team_members.length > 0) {
        const partner = champion.event_team_members[0];
        metadata.structuredData.winner = {
          "@type": "Team",
          "name": `${champion.username} & ${partner.username}`,
          "member": [
            {
              "@type": "Person",
              "name": champion.username
            },
            {
              "@type": "Person",
              "name": partner.username
            }
          ]
        };
      } else if (event.team_type === 'team' && champion.team_name) {
        metadata.structuredData.winner = {
          "@type": "Team",
          "name": champion.team_name
        };
      } else {
        metadata.structuredData.winner = {
          "@type": "Person",
          "name": champion.username
        };
      }
    }

    // Enhanced gallery images handling
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
    
    return { props: { metaData: metadata } };
  } catch (error) {
    console.error('Error fetching event for SEO:', error);
    return { props: { metaData: notFoundMetadata } };
  }
}

export default function EventDetail({ metaData }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState({
    isRegistered: false,
    isLoading: true,
    registeredCount: 0,
    registrationLimit: null,
    teamMembers: [],
    availableTeamMembers: [],
    registeredBy: null
  });
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]);
  const [teamType, setTeamType] = useState('solo');
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [registrationNotes, setRegistrationNotes] = useState('');
  const searchInputRef = useRef(null);
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase } = useAuth();
  const { openLoginModal } = useModal();
  const [bracketData, setBracketData] = useState(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const eventId = useRef(null);
  // Remove debug info display flag - set to false by default
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [modalStep, setModalStep] = useState(1); // For mobile step-by-step flow

  // Check if we're on mobile 
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Listen for resize events
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Reset modal step when modal opens/closes
  useEffect(() => {
    if (isTeamModalOpen) {
      setModalStep(1);
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
  }, [isTeamModalOpen]);
  
  // Store event ID in ref to prevent re-renders
  if (event && event.id !== eventId.current) {
    eventId.current = event.id;
  }

  // Determine if this is a public view (no authenticated user)
  const isPublicView = !user;

  // Function to fetch the latest registration count
  const fetchLatestCount = async () => {
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
        console.log(`Updated event ${event.id} count to ${data.registered_count}`);
      }
    } catch (error) {
      console.error('Error fetching latest registration count:', error);
    }
  };

  // Fetch event details
  useEffect(() => {
    const fetchEventDetails = async () => {
      setLoading(true);
      // Ensure registration shows a loading state during initial page load for all users
      setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
      
      if (!id) return;
      
      try {
        // Check if user is authenticated to include auth token
        let headers = {
          'Content-Type': 'application/json'
        };
        
        // If user is authenticated, add authorization header
        if (user) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.access_token) {
              headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
            }
          } catch (sessionError) {
            console.error('Session error:', sessionError);
            // Continue without auth header
          }
        }
        
        // Fetch event details
        console.log("Fetching event details...");
        const response = await fetch(`/api/events/${id}`, {
          method: 'GET',
          headers
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Event Fetch Error (${response.status}):`, errorData);
          throw new Error(errorData.error || `Failed to fetch event: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle both formats: { event: {...} } or the event object directly
        const eventData = data.event || data;
        
        if (!eventData) {
          console.error("Invalid event data format:", data);
          throw new Error("Invalid event data format");
        }
        
        setEvent(eventData);
        
        // Set loading to false after event data is fetched
        setLoading(false);
        
        // Only fetch additional data if user is logged in
        if (user) {
          // Get access token for authenticated requests
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          
          if (accessToken) {
            // Fetch registration status in parallel
            fetchRegistrationStatus(accessToken).catch(error => {
              console.error('Error fetching registration status:', error);
            });
            
            // Try to fetch bracket data in parallel
            fetchBracketData(accessToken).catch(error => {
              console.error('Error fetching bracket data:', error);
              setBracketData(null);
            });
          }
        } else {
          // For unauthenticated users, try to fetch public bracket data
          fetchPublicBracketData().catch(error => {
            console.error('Error fetching public bracket data:', error);
            setBracketData(null);
          });
          
          // Also fetch the latest count for unauthenticated users to show the registration bar
          fetchLatestCount();
          
          // Set a timeout to show the loading animation for a moment before hiding
          setTimeout(() => {
            setRegistrationStatus(prev => ({
              ...prev,
              isLoading: false
            }));
          }, 1500);
        }
      } catch (error) {
        console.error('Error fetching event details:', error);
        setLoading(false);
      }
    };
    
    fetchEventDetails();
  }, [id, user, supabase]);
  
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
  
  // Set up real-time subscription for registration updates
  useEffect(() => {
    if (!event || !supabase) return;
    
    console.log("Setting up real-time subscription for event:", event.id);
    
    // Subscribe to changes in the event_registrations table
    const channel = supabase
      .channel(`event-${event.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_registrations',
          filter: `event_id=eq.${event.id}`
        },
        (payload) => {
          console.log('New registration detected:', payload);
          // Fetch the latest count instead of incrementing
          fetchLatestCount();
          toast.success('Someone just registered for this event!', { duration: 3000 });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_registrations',
          filter: `event_id=eq.${event.id}`
        },
        async (payload) => {
          console.log('Registration cancellation detected:', payload);
          // Fetch the latest count and updated registration status
          fetchLatestCount();
          
          // Also force refresh registration status for the user
          if (user) {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const accessToken = sessionData?.session?.access_token;
              
              if (accessToken) {
                await fetchRegistrationStatus(accessToken);
              }
            } catch (error) {
              console.error('Error refreshing registration status after cancellation:', error);
            }
          }
          
          toast('Someone cancelled their registration', { duration: 3000 });
        }
      )
      // Add a more reliable way to detect unregistrations through UPDATE events
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${event.id}`
        },
        async (payload) => {
          console.log('Event data updated:', payload);
          // This will update the count if it changed
          fetchLatestCount();
          
          // Also refresh registration status for the user
          if (user) {
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const accessToken = sessionData?.session?.access_token;
              
              if (accessToken) {
                await fetchRegistrationStatus(accessToken);
              }
            } catch (error) {
              console.error('Error refreshing registration status after event update:', error);
            }
          }
        }
      )
      .subscribe();
    
    // Fetch the latest count when the component mounts
    fetchLatestCount();
    
    // Set up a periodic sync every 10 seconds instead of 30 to catch missed events
    const intervalId = setInterval(fetchLatestCount, 10000);
    
    // Clean up subscription when component unmounts
    return () => {
      console.log("Cleaning up subscription for event:", event.id);
      supabase.channel(`event-${event.id}`).unsubscribe();
      clearInterval(intervalId);
    };
  }, [event, supabase]);
  
  // Fetch registration status
  const fetchRegistrationStatus = async (accessToken) => {
    try {
      console.log("Fetching registration status...");
      const response = await fetch(`/api/events/register?eventId=${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to fetch registration status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Registration status:", data);
      
      // Update team type from event data if available
      if (data.event && data.event.team_type) {
        setTeamType(data.event.team_type);
      }
      
      // Update registration status
      setRegistrationStatus({
        isRegistered: data.isRegistered,
        isLoading: false,
        registeredCount: data.event?.registered_count || 0,
        registrationLimit: data.event?.registration_limit || null,
        teamMembers: data.teamMembers || [],
        availableTeamMembers: data.availableTeamMembers || [],
        registeredBy: data.registeredBy || null
      });
      
      return data.isRegistered;
    } catch (error) {
      console.error('Error fetching registration status:', error);
      return false;
    }
  };
  
  // Function to fetch bracket data
  const fetchBracketData = async (accessToken) => {
    if (!id) return;
    
    setBracketLoading(true);
    console.log("Fetching bracket data for event ID:", id);
    
    try {
      if (!accessToken) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.access_token) {
        console.error("No access token available for bracket fetch");
        throw new Error('Authentication token not available');
        }
        
        accessToken = sessionData.session.access_token;
      }
      
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log("Bracket API response status:", response.status);
      
      // If 404, it means no bracket exists yet, which is not an error
      if (response.status === 404) {
        console.log("No bracket found for this event");
        setBracketData(null);
        setBracketLoading(false);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Bracket data received:", data);
      
      if (data && data.bracket) {
        console.log("Setting bracket data");
        setBracketData(data);
      } else {
        console.log("No valid bracket data found");
        setBracketData(null);
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      setBracketData(null);
      throw error; // Re-throw the error so the caller can handle it
    } finally {
      setBracketLoading(false);
    }
  };
  
  // Add this function to generate a bracket (admin only)
  const handleGenerateBracket = async () => {
    if (!user?.isAdmin || !id) return;
    
    setBracketLoading(true);
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error('Authentication token not available');
      }
      
      // Generate bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to generate bracket: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.bracket) {
        setBracketData(data);
        toast.success('Tournament bracket generated successfully!');
      }
    } catch (error) {
      console.error('Error generating bracket:', error);
      toast.error(error.message || 'Failed to generate tournament bracket');
    } finally {
      setBracketLoading(false);
    }
  };
  
  // Add this function to delete a bracket (admin only)
  const handleDeleteBracket = async () => {
    if (!user?.isAdmin || !id) return;
    
    if (!confirm('Are you sure you want to delete this tournament bracket? This action cannot be undone.')) {
      return;
    }
    
    setBracketLoading(true);
    
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
      
      const data = await response.json();
      
      setBracketData(null);
      toast.success(data.message || 'Tournament bracket deleted successfully!');
    } catch (error) {
      console.error('Error deleting bracket:', error);
      toast.error(error.message || 'Failed to delete tournament bracket');
    } finally {
      setBracketLoading(false);
    }
  };
  
  // Filter team members based on search query
  const filteredTeamMembers = registrationStatus.availableTeamMembers.filter(member => 
    member.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Open team selection modal
  const openTeamModal = () => {
    setIsTeamModalOpen(true);
    // Focus the search input after modal opens
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };
  
  // Close team selection modal
  const closeTeamModal = () => {
    setIsTeamModalOpen(false);
    setSearchQuery('');
  };
  
  // Open cancel confirmation modal
  const openCancelModal = () => {
    setIsCancelModalOpen(true);
  };
  
  // Close cancel confirmation modal
  const closeCancelModal = () => {
    setIsCancelModalOpen(false);
  };
  
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
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        toast.error('Authentication token not available');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // Cancel registration
      const response = await fetch('/api/events/register', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ eventId: id })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Display specific error message from API if available
        toast.error(data.message || 'Failed to cancel registration');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      toast.success(data.message || 'Registration cancelled successfully');
      
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
        setTimeout(async () => {
          try {
            // This delayed refresh ensures we get the latest state from the server
            await fetchRegistrationStatus(accessToken);
            console.log("Forced refresh after unregistration completed");
          } catch (error) {
            console.error("Error in forced refresh:", error);
          }
        }, 1000); // Small delay to ensure server has time to process
      }
    } catch (error) {
      console.error('Error canceling registration:', error);
      toast.error(error.message || 'An error occurred');
    } finally {
      setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
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
      if (teamType !== 'solo') {
        openTeamModal();
      } else {
        // For solo events, proceed with registration
        handleRegistration();
      }
    }
  };
  
  // Handle next step in mobile modal flow
  const goToNextStep = () => {
    setModalStep(prevStep => prevStep + 1);
  };
  
  // Handle previous step in mobile modal flow
  const goToPrevStep = () => {
    setModalStep(prevStep => Math.max(1, prevStep - 1));
  };
  
  // Complete registration function remains but now works with both desktop and mobile
  const completeRegistration = () => {
    // For duo events, ensure exactly one team member is selected
    if (teamType === 'duo' && selectedTeamMembers.length !== 1) {
      toast.error('Please select exactly one team partner for duo events');
      return;
    }
    
    // For team events, ensure at least one team member is selected
    if (teamType === 'team' && selectedTeamMembers.length === 0) {
      toast.error('Please select at least one team member');
      return;
    }
    
    // For team events, ensure team name is provided
    if (teamType === 'team' && (!teamName || teamName.trim() === '')) {
      toast.error('Please provide a name for your team');
      return;
    }
    
    // Close the modal and proceed with registration
    closeTeamModal();
    handleRegistration();
  };
  
  // Handle team member selection
  const handleTeamMemberSelection = (member) => {
    // Check if member is already selected
    const isSelected = selectedTeamMembers.some(m => m.userId === member.id);
    
    if (isSelected) {
      // Remove member
      setSelectedTeamMembers(prev => prev.filter(m => m.userId !== member.id));
      
      // For duo events, clear out the auto-generated team name if we removed the partner
      if (teamType === 'duo' && teamName.includes(' & ')) {
        setTeamName('');
      }
    } else {
      // Add member
      if (teamType === 'duo' && selectedTeamMembers.length >= 1) {
        // For duo events, replace the existing selection
        setSelectedTeamMembers([{ userId: member.id, username: member.username }]);
        
        // Auto-generate team name for duo events - "User1 & User2"
        if (user) {
          const userName = user.username || user.email?.split('@')[0] || 'You';
          setTeamName(`${userName} & ${member.username}`);
        }
      } else if (teamType === 'duo' && selectedTeamMembers.length === 0) {
        // For duo events, add the first partner and generate team name
        setSelectedTeamMembers([{ userId: member.id, username: member.username }]);
        
        // Auto-generate team name for duo events - "User1 & User2"
        if (user) {
          const userName = user.username || user.email?.split('@')[0] || 'You';
          setTeamName(`${userName} & ${member.username}`);
        }
      } else {
        // For team events, add to the selection
        setSelectedTeamMembers(prev => [...prev, { userId: member.id, username: member.username }]);
      }
    }
  };
  
  // Reset team name whenever the modal is closed
  useEffect(() => {
    if (!isTeamModalOpen) {
      setTeamName('');
    }
  }, [isTeamModalOpen]);
  
  // Handle registration
  const handleRegistration = async () => {
    if (registrationStatus.isLoading) return;
    
    setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        toast.error('Authentication token not available');
        setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }
      
      // For duo or team events, validate team selection and team name
      if ((teamType === 'duo' || teamType === 'team') && (!selectedTeamMembers || selectedTeamMembers.length === 0)) {
        toast.error(`Please select at least one team member for this ${teamType} event`);
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
      // Validate team name for team events only (duo teams can have optional names)
      if (teamType === 'team' && (!teamName || teamName.trim() === '')) {
        toast.error('Please provide a name for your team');
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
      // Prepare API call
        const response = await fetch('/api/events/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ 
            eventId: id,
          teamMembers: selectedTeamMembers,
          notes: registrationNotes,
          teamName: teamName.trim() || (teamType === 'duo' && selectedTeamMembers.length === 1 ? 
            `${user.username || 'You'} & ${selectedTeamMembers[0].username}` : '') // Auto-generate team name for duo events if not provided
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
        // Display error as toast instead of throwing an error
        toast.error(data.message || 'Registration failed');
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        // Success!
        toast.success(data.message || 'Registered for event successfully');
      
      // Reset form fields
      setSelectedTeamMembers([]);
      setRegistrationNotes('');
      setTeamName('');
      
      // Close the modal
      closeTeamModal();
        
        // Refresh registration status to get team members
        await fetchRegistrationStatus(accessToken);
    } catch (error) {
      console.error('Error handling registration:', error);
      toast.error(error.message || 'An error occurred');
    } finally {
      setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
    }
  };
  
  // Get registration button text
  const getRegistrationButtonText = () => {
    if (!event || registrationStatus.isLoading) {
      return 'Loading...';
    }
    
    if (event.status === 'Completed') {
      return 'Event Ended';
    }
    
    if (event.status === 'In Progress') {
      return 'In Progress';
    }
    
    // Check if registration is full
    if (registrationStatus.registrationLimit !== null && 
        registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
        !registrationStatus.isRegistered) {
      return 'Registration Full';
    }
    
    // For public users on upcoming events
    if (isPublicView) {
      return event.status === 'Upcoming' ? 'Login to Register' : 'Register Now';
    }
    
    if (registrationStatus.isRegistered) {
      if (registrationStatus.registeredBy) {
        return `Registered by ${registrationStatus.registeredBy}`;
      } else {
        return 'Registered';
      }
    }
    
    return 'Register Now';
  };
  
  // Get registration button class
  const getRegistrationButtonClass = () => {
    const baseClass = styles.registerButton;
    
    if (!event || registrationStatus.isLoading) {
      return `${baseClass} ${styles.loadingButton}`;
    }
    
    if (event.status === 'Completed') {
      return `${baseClass} ${styles.completedButton}`;
    }
    
    if (event.status === 'In Progress') {
      return `${baseClass} ${styles.inProgressButton}`;
    }
    
    // Check if registration is full
    if (registrationStatus.registrationLimit !== null && 
        registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
        !registrationStatus.isRegistered) {
      return `${baseClass} ${styles.fullButton}`;
    }
    
    if (registrationStatus.isRegistered) {
      if (registrationStatus.registeredBy) {
        return `${baseClass} ${styles.teamMemberButton}`;
      } else {
        return `${baseClass} ${styles.registeredButton}`;
      }
    }
    
    return baseClass;
  };
  
  // Check if registration button should be disabled
  const isRegistrationButtonDisabled = () => {
    if (!event || registrationStatus.isLoading) {
      return true;
    }
    
    if (event.status !== 'Upcoming') {
      return true;
    }
    
    // Check if registration is full (but allow cancellation)
    if (registrationStatus.registrationLimit !== null && 
        registrationStatus.registeredCount >= registrationStatus.registrationLimit &&
        !registrationStatus.isRegistered) {
      return true;
    }
    
    return false;
  };

  // Add a safety timeout to ensure loading state is reset if it gets stuck
  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        console.log('Loading timeout reached, forcing loading state to false');
        setLoading(false);
        toast.error('Loading is taking longer than expected. Some data may still be loading in the background.');
      }, 5000); // 5 seconds timeout
      
      return () => clearTimeout(timeoutId);
    }
  }, [loading]);

  // Add a function to fetch public bracket data
  const fetchPublicBracketData = async () => {
    if (!id) return;
    
    setBracketLoading(true);
    console.log("Fetching public bracket data for event ID:", id);
    
    try {
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log("Bracket API response status:", response.status);
      
      // If 404, it means no bracket exists yet, which is not an error
      if (response.status === 404) {
        console.log("No bracket found for this event");
        setBracketData(null);
        setBracketLoading(false);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch bracket data: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Bracket data received:", data);
      
      if (data && data.bracket) {
        console.log("Setting bracket data");
        setBracketData(data);
      } else {
        console.log("No valid bracket data found");
        setBracketData(null);
      }
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      setBracketData(null);
      throw error;
    } finally {
      setBracketLoading(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <DynamicMeta {...metaData} excludeFromAppSeo={true} />

      <div className={styles.container}>
        <Link href="/events" className={styles.backLink}>
          &larr; Back to Events
        </Link>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <p>Loading event details...</p>
          </div>
        ) : !event ? (
          <div className={styles.notFoundContainer}>
            <h1 className={styles.notFoundTitle}>Event Not Found</h1>
            <p>The event you're looking for doesn't exist or has been removed.</p>
            <Link href="/events" className={styles.backButton}>
              Back to Events
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.eventDetail}>
              <div className={styles.eventHeader}>
                <div className={styles.eventImageContainer}>
                  {event.image ? (
                    <img 
                      src={event.image} 
                      alt={event.title} 
                      className={styles.eventImage}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.parentNode.classList.add(styles.fallbackImage);
                      }}
                    />
                  ) : (
                    <div className={styles.eventImagePlaceholder}>
                      <div className={styles.placeholderText}>{event.title.charAt(0).toUpperCase()}</div>
                    </div>
                  )}
                  <div className={`${styles.eventStatusBadge} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
                    {event.status || 'Upcoming'}
                  </div>
                </div>
                <div className={styles.eventInfo}>
                  <h1 className={styles.eventTitle}>{event.title}</h1>
                  
                  {/* Registration status indicator - only for authenticated users */}
                  {!isPublicView && registrationStatus.isRegistered && (
                    <div className={styles.registrationStatusIndicator}>
                      {registrationStatus.registeredBy ? (
                        <span className={styles.registeredByIndicator}>
                          <span className={styles.checkIcon}>✓</span> Registered by {registrationStatus.registeredBy}
                        </span>
                      ) : (
                        <span className={styles.registeredIndicator}>
                          <span className={styles.checkIcon}>✓</span> Registered for this event
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Date:</span>
                    <span>{event.date ? formatDate(event.date) : 'TBD'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Time:</span>
                    <span>{event.time || 'TBD'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Location:</span>
                    <span>{event.location || 'TBD'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Game:</span>
                    <span>{event.game || 'TBD'}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Team Type:</span>
                    <span>
                      {event.team_type === 'solo' ? 'Solo (Individual)' : 
                       event.team_type === 'duo' ? 'Duo (2 Players)' : 
                       'Team (Multiple Players)'}
                    </span>
                  </div>
                  {/* Duo/team member info - only for authenticated users */}
                  {!isPublicView && teamType === 'duo' && registrationStatus.isRegistered && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Duo Partner:</span>
                      <span className={styles.partnerName}>
                        {registrationStatus.registeredBy ? (
                          <>{registrationStatus.registeredBy}</>
                        ) : registrationStatus.teamMembers.length > 0 ? (
                          <>{registrationStatus.teamMembers[0].username}</>
                        ) : (
                          'None'
                        )}
                      </span>
                    </div>
                  )}
                  
                  {/* Team members in event details - only for authenticated users */}
                  {!isPublicView && teamType === 'team' && registrationStatus.isRegistered && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Team Members:</span>
                      <div className={styles.teamMembersInline}>
                        {registrationStatus.registeredBy ? (
                          <span className={styles.partnerName}>
                            {registrationStatus.registeredBy} (Team Leader)
                          </span>
                        ) : (
                          <span className={styles.teamLeaderBadge}>You (Team Leader)</span>
                        )}
                        
                        {registrationStatus.teamMembers.length > 0 && (
                          <div className={styles.teamMembersChips}>
                            {registrationStatus.teamMembers.map(member => (
                              <span key={member.user_id} className={styles.teamMemberChip}>
                                {member.username}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Registrations:</span>
                    <span>
                      {registrationStatus.registeredCount}
                      {registrationStatus.registrationLimit !== null && 
                        ` / ${registrationStatus.registrationLimit}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.eventContent}>
                <section className={styles.eventDescriptionSection}>
                  <h2 className={styles.sectionHeading}>
                    <FaInfo /> Event Details
                  </h2>
                  <div className={styles.eventDescription}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // Custom link component that opens external links in new tab
                        a: ({ node, ...props }) => {
                          const isExternal = props.href?.startsWith('http');
                          return (
                            <a 
                              {...props} 
                              target={isExternal ? '_blank' : undefined}
                              rel={isExternal ? 'noopener noreferrer' : undefined}
                              className={styles.markdownLink}
                            />
                          );
                        },
                        // Custom heading components
                        h1: ({ node, ...props }) => <h1 className={styles.markdownH1} {...props} />,
                        h2: ({ node, ...props }) => <h2 className={styles.markdownH2} {...props} />,
                        h3: ({ node, ...props }) => <h3 className={styles.markdownH3} {...props} />,
                        // Custom list components
                        ul: ({ node, ...props }) => <ul className={styles.markdownList} {...props} />,
                        ol: ({ node, ...props }) => <ol className={styles.markdownList} {...props} />,
                        // Custom code components
                        code: ({ node, inline, ...props }) => (
                          inline ? 
                            <code className={styles.markdownInlineCode} {...props} /> :
                            <code className={styles.markdownCode} {...props} />
                        ),
                        // Custom blockquote
                        blockquote: ({ node, ...props }) => <blockquote className={styles.markdownBlockquote} {...props} />,
                        // Custom table components
                        table: ({ node, ...props }) => <table className={styles.markdownTable} {...props} />,
                        th: ({ node, ...props }) => <th className={styles.markdownTh} {...props} />,
                        td: ({ node, ...props }) => <td className={styles.markdownTd} {...props} />,
                      }}
                    >
                      {event.description}
                    </ReactMarkdown>
                  </div>
                </section>
                
                <section className={styles.registrationSection}>
                  <h2 className={styles.sectionHeading}>
                    <FaUserPlus /> Registration
                  </h2>
                  <div className={styles.eventActions}>
                    {/* For completed events, don't show the gray "EVENT ENDED" button, 
                        just show a nice tournament bracket button */}
                    {event.status === 'Completed' ? (
                      <div className={styles.endedEventActions}>
                        {/* Display champions here when event is completed */}
                        {bracketData && bracketData.bracket && (() => {
                          // Find if there's a winner
                          let winner = null;
                          const matches = bracketData.bracket;
                          const finalRound = matches[matches.length - 1];
                          
                          if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
                            winner = bracketData.participants.find(p => p.id === finalRound[0].winnerId);
                          }
                          
                          return winner && (
                            <div className={styles.championsContainer}>
                              <TournamentWinner 
                                winner={winner} 
                                teamType={event.team_type} 
                                eventId={id} 
                              />
                            </div>
                          );
                        })()}
                        
                        {/* Show regular bracket link if no champions data available */}
                        {bracketData && bracketData.bracket && 
                         !bracketData.bracket[bracketData.bracket.length - 1]?.[0]?.winnerId && (
                          <Link 
                            href={`/events/${id}/bracket`} 
                            className={styles.tournamentBracketButton}
                          >
                            <FaSitemap className={styles.bracketIcon} /> View Tournament Bracket
                          </Link>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Login prompt for public users - only for upcoming events */}
                        {isPublicView && event.status === 'Upcoming' && (
                          <div className={styles.loginPrompt}>
                            <p>Please log in to register for this event</p>
                            <button onClick={openLoginModal} className={styles.loginButton}>
                              Login
                            </button>
                          </div>
                        )}
                        
                        {/* Status message for in-progress events - for public users */}
                        {isPublicView && event.status === 'In Progress' && (
                          <div className={styles.eventStatusMessage}>
                            <p>This event is currently in progress</p>
                          </div>
                        )}
                        
                        {/* Registration/Cancel buttons - only for authenticated users */}
                        {!isPublicView && (
                          <>
                            {/* Only show registration button if user is NOT registered */}
                            {!registrationStatus.isRegistered ? (
                              <button 
                                className={getRegistrationButtonClass()}
                                onClick={handleRegistrationClick}
                                disabled={isRegistrationButtonDisabled()}
                              >
                                {getRegistrationButtonText()}
                              </button>
                            ) : null}
                            
                            {/* Show cancel button ONLY if: 
                              1. User is registered 
                              2. User is the main registrant (not added by someone else)
                              3. Event is still upcoming (not in progress or completed)
                            */}
                            {registrationStatus.isRegistered && 
                             !registrationStatus.registeredBy && 
                             event.status === 'Upcoming' && (
                              <button 
                                className={`${styles.registerButton} ${styles.cancelButton}`}
                                onClick={handleCancelClick}
                                disabled={registrationStatus.isLoading}
                              >
                                Cancel Registration
                              </button>
                            )}
                          </>
                        )}
                        
                        {/* View Tournament Bracket button - for non-completed events */}
                        {bracketData && bracketData.bracket && (
                          <Link 
                            href={`/events/${id}/bracket`} 
                            className={`${styles.bracketButton} ${
                              (isPublicView && event.status !== 'Upcoming') ? styles.tournamentBracketButton : ''
                            }`}
                          >
                            <FaSitemap className={styles.bracketIcon} /> View Tournament Bracket
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </section>
                
                {/* Registration information - for all users */}
                {event.status === 'Upcoming' && !registrationStatus.isLoading && (
                  <div className={styles.registrationInfo}>
                    <h3>Registration Information</h3>
                    {registrationStatus.registrationLimit !== null ? (
                      <p>
                        {registrationStatus.registeredCount} out of {registrationStatus.registrationLimit} spots filled
                        {registrationStatus.registeredCount >= registrationStatus.registrationLimit ? 
                          ' (Registration is full)' : ''}
                      </p>
                    ) : (
                      <p>{registrationStatus.registeredCount} {registrationStatus.registeredCount === 1 ? 'person has' : 'people have'} registered for this event</p>
                    )}
                    
                    <div className={styles.progressBarContainer}>
                      <div 
                        className={styles.progressBar}
                        style={{ 
                          width: registrationStatus.registrationLimit !== null ? 
                            `${Math.min(100, (registrationStatus.registeredCount / registrationStatus.registrationLimit) * 100)}%` : 
                            '100%',
                          backgroundColor: registrationStatus.registeredCount >= registrationStatus.registrationLimit ? 
                            '#dc3545' : '#28a745'
                        }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Loading indicator for registration info - show only during loading */}
                {event.status === 'Upcoming' && registrationStatus.isLoading && (
                  <div className={styles.registrationInfoLoading}>
                    <div className={styles.loadingPulse}></div>
                  </div>
                )}
                
                {/* Admin section - only for admins */}
                {user?.isAdmin && (
                  <div className={styles.adminSection}>
                    <h3>Admin Controls</h3>
                    <div className={styles.adminButtonsContainer}>
                      <div className={styles.adminButtonGroup}>
                        <h4>Event Management</h4>
                        <Link href={`/admin/events?edit=${event.id}`} className={styles.adminEditButton}>
                          <span>✏️</span> Edit Event Details
                        </Link>
                      </div>
                      
                      <div className={styles.adminButtonGroup}>
                        <h4>Registration Management</h4>
                        <Link href={`/admin/events/registrations/${event.id}`} className={styles.viewRegistrationsButton}>
                          <span>👥</span> View All Registrations
                        </Link>
                      </div>
                      
                      <div className={styles.adminButtonGroup}>
                        <h4>Tournament Bracket</h4>
                        {!bracketData || !bracketData.bracket ? (
                          <button 
                            className={styles.generateBracketButton}
                            onClick={handleGenerateBracket}
                            disabled={bracketLoading}
                          >
                            <FaSitemap className={styles.bracketIcon} />
                            Generate Tournament Bracket
                          </button>
                        ) : (
                          <button 
                            className={styles.deleteBracketButton}
                            onClick={handleDeleteBracket}
                            disabled={bracketLoading}
                          >
                            Delete Tournament Bracket
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Event Gallery Section */}
            {event && (
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
          </>
        )}
        
        {/* Team selection modal - no change needed here */}
        {isTeamModalOpen && (
          <div className={styles.modalOverlay} onClick={closeTeamModal}>
            {isMobile ? (
              <MobileTeamModal
                filteredTeamMembers={filteredTeamMembers}
                selectedTeamMembers={selectedTeamMembers}
                searchQuery={searchQuery}
                onSearchChange={e => setSearchQuery(e.target.value)}
                handleTeamMemberSelection={handleTeamMemberSelection}
                modalStep={modalStep}
                goToNextStep={goToNextStep}
                goToPrevStep={goToPrevStep}
                completeRegistration={completeRegistration}
                teamType={teamType}
                closeModal={closeTeamModal}
                teamName={teamName}
                onTeamNameChange={setTeamName}
                notes={registrationNotes}
                onNotesChange={setRegistrationNotes}
                registrationStatus={registrationStatus}
                eventTitle={event?.title}
              />
            ) : (
              <DesktopTeamModal
                filteredTeamMembers={filteredTeamMembers}
                selectedTeamMembers={selectedTeamMembers}
                searchQuery={searchQuery}
                onSearchChange={e => setSearchQuery(e.target.value)}
                handleTeamMemberSelection={handleTeamMemberSelection}
                completeRegistration={completeRegistration}
                teamType={teamType}
                closeModal={closeTeamModal}
                teamName={teamName}
                onTeamNameChange={setTeamName}
                notes={registrationNotes}
                onNotesChange={setRegistrationNotes}
                registrationStatus={registrationStatus}
              />
            )}
          </div>
        )}
        
        {/* Cancellation confirmation modal */}
        {isCancelModalOpen && (
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