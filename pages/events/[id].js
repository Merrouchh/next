import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { FaSearch, FaTimes, FaUserPlus, FaTrophy, FaSitemap, FaImage } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import EventGallery from '../../components/EventGallery';
import React from 'react';
import DynamicMeta from '../../components/DynamicMeta';

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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://merrouchgaming.com';
    let result = await fetchWithErrorHandling(`${baseUrl}/api/events/${id}`);
    
    // If that fails, try with relative URL
    if (!result.success) {
      result = await fetchWithErrorHandling(`/api/events/${id}`, {
        headers: { 'x-forwarded-host': 'localhost:3000' }
      });
    }
    
    // If both fail, return not found
    if (!result.success) {
      return { props: { metaData: notFoundMetadata } };
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
        if (bracketData.bracket && bracketData.participants && bracketData.bracket.length > 0) {
          const finalRound = bracketData.bracket[bracketData.bracket.length - 1];
          if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
            hasWinner = true;
            champion = bracketData.participants.find(p => p.id === finalRound[0].winnerId);
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
        }
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
      
      // Add ImageGallery schema as additional structured data
      const imageGallerySchema = {
        "@context": "https://schema.org",
        "@type": "ImageGallery",
        "associatedMedia": galleryImages.map(img => {
          const imgUrl = img.image_url.startsWith('http') 
            ? img.image_url 
            : `${baseUrl}${img.image_url.startsWith('/') ? '' : '/'}${img.image_url}`;
          
          return {
            "@type": "ImageObject",
            "contentUrl": imgUrl,
            "description": img.caption || `${event.title} - Gaming event image`,
            "name": img.caption || event.title,
            "encodingFormat": "image/jpeg", // Assuming JPEG, adjust if needed
            "uploadDate": img.created_at || new Date().toISOString(),
            "about": {
              "@type": "Event",
              "name": event.title,
              "description": event.description || `${event.game || 'Gaming'} tournament`
            }
          };
        }),
        "thumbnailUrl": galleryImages.length > 0 
          ? (galleryImages[0].image_url.startsWith('http') 
            ? galleryImages[0].image_url 
            : `${baseUrl}${galleryImages[0].image_url.startsWith('/') ? '' : '/'}${galleryImages[0].image_url}`) 
          : (imageUrl || "https://merrouchgaming.com/events.jpg"),
        "creator": {
          "@type": "Organization",
          "name": "Merrouch Gaming",
          "url": "https://merrouchgaming.com"
        },
        "about": {
          "@type": "Event",
          "name": event.title,
          "description": event.description || `${event.game || 'Gaming'} tournament`,
          "url": `https://merrouchgaming.com/events/${id}`
        }
      };
      
      // Add the gallery schema as additional structured data
      metadata.structuredData = [metadata.structuredData, imageGallerySchema];
      
      // Add gallery images to OpenGraph for better social sharing
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
  const searchInputRef = useRef(null);
  const router = useRouter();
  const { id } = router.query;
  const { user, supabase } = useAuth();
  const { openLoginModal } = useModal();
  const [bracketData, setBracketData] = useState(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const eventId = useRef(null);

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
  const confirmCancellation = () => {
    closeCancelModal();
    handleRegistration();
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
  
  // Complete registration with selected team members
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
    
    // Close the modal and proceed with registration
    closeTeamModal();
    handleRegistration();
  };
  
  // Handle registration
  const handleRegistration = async () => {
    if (registrationStatus.isLoading) return;
    
    setRegistrationStatus(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication token not available');
      }
      
      if (registrationStatus.isRegistered) {
        // We only allow cancellation for upcoming events
        // This check is redundant now since the button isn't shown, but we'll keep it as a safety measure
        if (event && event.status !== 'Upcoming') {
          toast.error('Cannot cancel registration once the event has started');
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
          throw new Error(data.message || 'Failed to cancel registration');
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
        
        setSelectedTeamMembers([]);
      } else {
        // Check if registration is full before registering
        if (registrationStatus.registrationLimit !== null && 
            registrationStatus.registeredCount >= registrationStatus.registrationLimit) {
          toast.error('This event has reached its registration limit.');
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        // Register for event
        const response = await fetch('/api/events/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ 
            eventId: id,
            teamMembers: selectedTeamMembers
          })
        });
        
        // Parse response data first to get any error messages
        const data = await response.json();
        
        // Check if response was successful
        if (!response.ok) {
          // Extract the specific error message, especially for team member errors
          if (data.message && data.message.includes('team members are already registered')) {
            // Make the error message more user-friendly
            toast.error(data.message, { duration: 5000 });
          } else if (data.message && data.message.includes('currently involved in another registration process')) {
            // Show a more helpful message for concurrency issues
            toast.error('This user is currently being registered by someone else. Please try again in a few moments.', 
              { duration: 5000 });
          } else {
            // Generic error
            toast.error(data.message || 'Failed to register for event');
          }
          setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }
        
        // Success!
        toast.success(data.message || 'Registered for event successfully');
        
        // Refresh registration status to get team members
        await fetchRegistrationStatus(accessToken);
      }
    } catch (error) {
      console.error('Error handling registration:', error);
      toast.error(error.message || 'An error occurred');
    } finally {
      setRegistrationStatus(prev => ({ ...prev, isLoading: false }));
    }
  };
  
  // Handle team member selection
  const handleTeamMemberSelection = (member) => {
    // Check if member is already selected
    const isSelected = selectedTeamMembers.some(m => m.userId === member.id);
    
    if (isSelected) {
      // Remove member
      setSelectedTeamMembers(prev => prev.filter(m => m.userId !== member.id));
    } else {
      // Add member
      if (teamType === 'duo' && selectedTeamMembers.length >= 1) {
        // For duo events, replace the existing selection
        setSelectedTeamMembers([{ userId: member.id, username: member.username }]);
      } else {
        // For team events, add to the selection
        setSelectedTeamMembers(prev => [...prev, { userId: member.id, username: member.username }]);
      }
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

  // Check if mobile on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkIfMobile = () => {
        setIsMobile(window.innerWidth <= 767);
      };
      
      checkIfMobile();
      window.addEventListener('resize', checkIfMobile);
      
      return () => {
        window.removeEventListener('resize', checkIfMobile);
      };
    }
  }, []);

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
      <DynamicMeta {...metaData} />

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
            <h2>Event Not Found</h2>
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
                <div className={styles.eventDescription}>
                  {event.description.split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
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
                            <div className={styles.bracketWinner}>
                              <FaTrophy className={styles.trophyIcon} />
                              {event.team_type === 'duo' ? (
                                <span>
                                  Champions: {winner.name}
                                  {winner.members && winner.members.length > 0 && (
                                    <span className={styles.winnerPartner}> & {winner.members[0]?.name}</span>
                                  )}
                                </span>
                              ) : (
                                <span>Champion: {winner.name}</span>
                              )}
                            </div>
                            <Link 
                              href={`/events/${id}/bracket`} 
                              className={styles.tournamentBracketButton}
                            >
                              <FaSitemap className={styles.bracketIcon} /> View Tournament Bracket
                            </Link>
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

              {/* Event Gallery Section */}
              {event && (
                <div className={styles.galleryContainer}>
                  {/* Use memoized component to prevent re-renders */}
                  {eventId.current && (
                    <MemoizedEventGallery 
                      key={`gallery-${eventId.current}`} 
                      eventId={eventId.current} 
                    />
                  )}
                </div>
              )}
            </div>

            {/* Team selection and cancel modals - only for authenticated users */}
            {!isPublicView && (
              <>
      {isTeamModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.teamModal} ${isMobile ? styles.mobileModal : ''}`}>
            <div className={styles.modalHeader}>
              <h3>{teamType === 'duo' ? 'Select Team Partner' : 'Select Team Members'}</h3>
              <button 
                className={styles.closeButton}
                onClick={closeTeamModal}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className={styles.searchContainer}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                ref={searchInputRef}
                className={styles.searchInput}
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className={styles.modalInfo}>
              <p>
                <strong>Note:</strong> Users who are already registered or are team members in this event are not shown in the list.
              </p>
            </div>
            
            <div className={styles.modalContent}>
              {filteredTeamMembers.length > 0 ? (
                <div className={styles.teamMembersList}>
                  {filteredTeamMembers.map(member => (
                    <div 
                      key={member.id} 
                      className={`${styles.teamMember} ${
                        selectedTeamMembers.some(m => m.userId === member.id) ? styles.selected : ''
                      }`}
                      onClick={() => handleTeamMemberSelection(member)}
                    >
                      <span>{member.username}</span>
                      {selectedTeamMembers.some(m => m.userId === member.id) ? (
                        <span className={styles.checkmark}>✓</span>
                      ) : (
                        <FaUserPlus className={styles.addIcon} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.noResults}>
                  {searchQuery ? 'No users found matching your search' : 'No available users to select as team members'}
                </p>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={closeTeamModal}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={completeRegistration}
                disabled={
                  (teamType === 'duo' && selectedTeamMembers.length !== 1) || 
                  (teamType === 'team' && selectedTeamMembers.length === 0)
                }
              >
                {teamType === 'duo' 
                  ? selectedTeamMembers.length === 1 
                    ? `Register with ${selectedTeamMembers[0].username}` 
                    : 'Select a partner'
                  : selectedTeamMembers.length > 0 
                    ? `Register with ${selectedTeamMembers.length} team member${selectedTeamMembers.length !== 1 ? 's' : ''}` 
                    : 'Select team members'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {isCancelModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.cancelModal}>
            <div className={styles.modalHeader}>
              <h3>Cancel Registration</h3>
              <button 
                className={styles.closeButton}
                onClick={closeCancelModal}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.cancelWarning}>
                <p>Are you sure you want to cancel your registration for <strong>{event.title}</strong>?</p>
                
                {teamType !== 'solo' && registrationStatus.teamMembers.length > 0 && (
                  <p className={styles.teamWarning}>
                    <strong>Warning:</strong> This will also remove all your team members from the event.
                  </p>
                )}
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.secondaryButton}
                onClick={closeCancelModal}
              >
                No, Keep My Registration
              </button>
              <button 
                className={styles.confirmCancelButton}
                onClick={confirmCancellation}
              >
                Yes, Cancel Registration
              </button>
            </div>
          </div>
        </div>
      )}
              </>
            )}
          </>
        )}
      </div>
    </ProtectedPageWrapper>
  );
} 