import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { FaSearch, FaTimes, FaUserPlus, FaTrophy, FaSitemap } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';

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

export default function EventDetail() {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registrationStatus, setRegistrationStatus] = useState({
    isRegistered: false,
    isLoading: false,
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
  const [bracketData, setBracketData] = useState(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  // Redirect if not logged in
  useEffect(() => {
    if (!user && typeof window !== 'undefined') {
      router.replace('/');
    }
  }, [user, router]);

  // Fetch event details
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!id) return;
      
      setLoading(true);
      
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          console.error("No access token available");
          throw new Error('Authentication token not available');
        }
        
        // Fetch event details
        console.log("Fetching event details...");
        const response = await fetch(`/api/events/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Event Fetch Error (${response.status}):`, errorText);
          throw new Error(`Failed to fetch event: ${response.status}`);
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
        
        // Fetch registration status in parallel but don't block page load
        fetchRegistrationStatus(accessToken).catch(error => {
          console.error('Error fetching registration status:', error);
        });
        
        // Try to fetch bracket data in parallel but don't block page load
        fetchBracketData().catch(error => {
          console.error('Error fetching bracket data:', error);
          setBracketData(null);
        });
        
        // Fetch latest count
        fetchLatestCount();
        
      } catch (error) {
        console.error('Error fetching event details:', error);
        setLoading(false);
      }
    };
    
    if (user && id) {
      fetchEventDetails();
    }
  }, [id, user, supabase]);
  
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
        (payload) => {
          console.log('Registration cancellation detected:', payload);
          // Fetch the latest count instead of decrementing
          fetchLatestCount();
          toast('Someone cancelled their registration', { duration: 3000 });
        }
      )
      .subscribe();
    
    // Fetch the latest count when the component mounts
    fetchLatestCount();
    
    // Set up a periodic sync every 30 seconds
    const intervalId = setInterval(fetchLatestCount, 30000);
    
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
  const fetchBracketData = async () => {
    if (!id) return;
    
    setBracketLoading(true);
    console.log("Fetching bracket data for event ID:", id);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available for bracket fetch");
        throw new Error('Authentication token not available');
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
        throw new Error(`Failed to fetch bracket data: ${response.status}`);
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
    if (!user.isAdmin || !id) return;
    
    setBracketLoading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication token not available');
      }
      
      // Generate bracket
      const response = await fetch(`/api/events/${id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
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
    if (!user.isAdmin || !id) return;
    
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
    // Prevent cancellation if the event is not upcoming
    if (event && event.status !== 'Upcoming') {
      toast.error('Cannot cancel registration once the event has started');
      return;
    }
    
    openCancelModal();
  };
  
  // Confirm cancellation
  const confirmCancellation = () => {
    closeCancelModal();
    handleRegistration();
  };
  
  // Handle registration button click
  const handleRegistrationClick = () => {
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
  
  // Modify the handleRegistration function to not check for team members here
  // since we're now handling that in the completeRegistration function
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
        // Prevent cancellation if the event is not upcoming
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
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to cancel registration');
        }
        
        const data = await response.json();
        toast.success(data.message || 'Registration cancelled successfully');
        
        setRegistrationStatus(prev => ({
          ...prev,
          isRegistered: false,
          registeredCount: Math.max(0, prev.registeredCount - 1),
          teamMembers: []
        }));
        
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
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to register for event');
        }
        
        const data = await response.json();
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
    if (registrationStatus.isLoading) {
      return 'Processing...';
    }
    
    if (!event) {
      return 'Register Now';
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
    
    if (registrationStatus.isLoading) {
      return `${baseClass} ${styles.loadingButton}`;
    }
    
    if (!event) {
      return baseClass;
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
    if (registrationStatus.isLoading) {
      return true;
    }
    
    if (!event) {
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

  // If not authenticated, don't render anything
  if (!user) {
    return null;
  }

  // Add this section to the render part of the component, where appropriate
  const renderBracketPreview = () => {
    if (bracketLoading) {
      return (
        <div className={styles.bracketPreviewLoading}>
          <div className={styles.loader}></div>
          <p>Loading bracket...</p>
        </div>
      );
    }
    
    if (!bracketData || !bracketData.bracket) {
      return (
        <div className={styles.noBracketMessage}>
          <p>Tournament bracket has not been generated yet.</p>
          {user.isAdmin && (
            <button 
              className={styles.generateBracketButton}
              onClick={handleGenerateBracket}
              disabled={bracketLoading}
            >
              <FaSitemap className={styles.bracketIcon} />
              Generate Tournament Bracket
            </button>
          )}
        </div>
      );
    }
    
    const matches = bracketData.bracket;
    console.log("Rendering bracket preview with matches:", matches);
    
    // Check if matches is an array (could be an array of rounds)
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return (
        <div className={styles.noBracketMessage}>
          <p>Tournament bracket has not been properly generated yet.</p>
          {user.isAdmin && (
            <button 
              className={styles.generateBracketButton}
              onClick={handleGenerateBracket}
              disabled={bracketLoading}
            >
              <FaSitemap className={styles.bracketIcon} />
              Regenerate Tournament Bracket
            </button>
          )}
        </div>
      );
    }
    
    // Find if there's a winner
    let winner = null;
    let roundCount = matches.length;
    
    // Check the final round for a winner
    const finalRound = matches[matches.length - 1];
    if (finalRound && finalRound.length > 0 && finalRound[0].winnerId) {
      winner = bracketData.participants.find(p => p.id === finalRound[0].winnerId);
    }
    
    return (
      <div className={styles.bracketPreview}>
        {winner && (
          <div className={styles.bracketWinner}>
            <FaTrophy className={styles.trophyIcon} />
            <span>Winner: {winner.name}</span>
          </div>
        )}
        
        <div className={styles.bracketStats}>
          <div className={styles.bracketStat}>
            <span className={styles.statLabel}>Participants:</span>
            <span className={styles.statValue}>{bracketData.participants.length}</span>
          </div>
          <div className={styles.bracketStat}>
            <span className={styles.statLabel}>Rounds:</span>
            <span className={styles.statValue}>{roundCount}</span>
          </div>
          <div className={styles.bracketStat}>
            <span className={styles.statLabel}>Status:</span>
            <span className={styles.statValue}>
              {winner ? 'Completed' : 'In Progress'}
            </span>
          </div>
        </div>
        
        <div className={styles.bracketActions}>
          <Link href={`/events/${id}/bracket`} className={styles.viewBracketButton}>
            <FaSitemap className={styles.bracketIcon} />
            View Full Tournament Bracket
          </Link>
          
          {user.isAdmin && (
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
    );
  };

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>{event ? `${event.title} | MerrouchGaming` : 'Event Details | MerrouchGaming'}</title>
        <meta name="description" content={event ? `Details for ${event.title}` : 'Event details'} />
      </Head>

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
                  
                  {/* Registration status indicator */}
                  {registrationStatus.isRegistered && (
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
                  {/* Display duo partner in event details if registered for a duo event */}
                  {teamType === 'duo' && registrationStatus.isRegistered && (
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
                  
                  {/* Display team members in event details if registered for a team event */}
                  {teamType === 'team' && registrationStatus.isRegistered && (
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
                  
                  {/* Show cancel button if user is registered and is the main registrant */}
                  {registrationStatus.isRegistered && !registrationStatus.registeredBy && (
                    <button 
                      className={`${styles.registerButton} ${styles.cancelButton} ${event.status !== 'Upcoming' ? styles.disabledCancelButton : ''}`}
                      onClick={handleCancelClick}
                      disabled={registrationStatus.isLoading || event.status !== 'Upcoming'}
                      title={event.status !== 'Upcoming' ? 'Cannot cancel registration once the event has started' : ''}
                    >
                      Cancel Registration
                    </button>
                  )}
                  
                  {/* View Tournament Bracket button */}
                  <Link href={`/events/${id}/bracket`} className={styles.bracketButton}>
                    <FaTrophy /> View Tournament Bracket
                  </Link>
                  
                  {user?.isAdmin && (
                    <Link href={`/admin/events?edit=${event.id}`} className={styles.editButton}>
                      Edit Event
                    </Link>
                  )}
                </div>
                
                {/* Registration information */}
                {event.status === 'Upcoming' && (
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
                
                {/* Admin section - show registrations */}
                {user?.isAdmin && (
                  <div className={styles.adminSection}>
                    <h3>Admin: Manage Registrations</h3>
                    <Link href={`/admin/events/registrations/${event.id}`} className={styles.viewRegistrationsButton}>
                      View All Registrations
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Bracket section */}
            <div className={styles.bracketSection}>
              <h2 className={styles.sectionTitle}>
                <FaSitemap className={styles.sectionIcon} />
                Tournament Bracket
              </h2>
              {renderBracketPreview()}
            </div>
          </>
        )}
      </div>

      {/* Team selection modal */}
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

      {/* Cancel confirmation modal */}
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
    </ProtectedPageWrapper>
  );
} 