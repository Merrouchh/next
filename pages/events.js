import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import styles from '../styles/Events.module.css';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { toast } from 'react-hot-toast';
import { useModal } from '../contexts/ModalContext';
// DynamicMeta removed - metadata now handled in _document.js
import Image from 'next/image';
import { FaSearch, FaCalendarAlt, FaGamepad, FaTrophy, FaFilter } from 'react-icons/fa';

// Format date for display - moved to a utility function outside components
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

export async function getServerSideProps({ res }) {
  // Set cache headers for events page
  res.setHeader(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );
  res.setHeader(
    'Surrogate-Control',
    'public, max-age=60, stale-while-revalidate=300'
  );
  // Add Vary header to handle different cached versions
  res.setHeader('Vary', 'Cookie, Accept-Encoding');
  
  // Default fallback image
  let previewImage = "https://merrouchgaming.com/top.jpg";
  
  try {
    // Check if environment variables are defined
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      // Import Supabase server-side client
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Single optimized query for the latest event with a valid image
      // Try to get the latest active event with a valid image first
      const { data: latestEvent, error } = await supabase
        .from('events')
        .select('id, title, image')
        .or('status.eq.In Progress,status.eq.Upcoming')
        .not('image', 'is', null)
        .ilike('image', 'http%')
        .order('created_at', { ascending: false })
        .limit(1);
      
      // If no active events with valid images, try any event with a valid image
      if ((!latestEvent || latestEvent.length === 0) && !error) {
        const { data: anyEvent } = await supabase
          .from('events')
          .select('id, title, image')
          .not('image', 'is', null)
          .ilike('image', 'http%')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (anyEvent && anyEvent.length > 0 && anyEvent[0].image) {
          previewImage = anyEvent[0].image;
        }
      } else if (latestEvent && latestEvent.length > 0 && latestEvent[0].image) {
        previewImage = latestEvent[0].image;
      }
    }
  } catch (error) {
    console.error('Error fetching latest event image:', error);
    // Continue with default image
  }

  return {
    props: {}
  };
}

// Add LoadingSpinner component
const LoadingSpinner = () => (
  <div className={styles.loadingContainer}>
    <div className={styles.spinner}>
      <div className={styles.spinnerInner}></div>
    </div>
    <p className={styles.loadingText}>Loading events...</p>
  </div>
);

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [pageLoaded, setPageLoaded] = useState(false);

  // Mark the page as loaded after mount
  useEffect(() => {
    setPageLoaded(true);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
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
        
        const response = await fetch('/api/events', {
          method: 'GET',
          headers
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch events: ${response.status}`);
        }
        
        const data = await response.json();
        setEvents(data);
        
        // Sync registration counts if user is logged in
        if (user) {
          syncRegistrationCounts(data);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events. Please try again later.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch events even without a user
    fetchEvents();
  }, [user, supabase]);
  
  // Function to sync registration counts with the database
  const syncRegistrationCounts = async (eventsList) => {
    if (!eventsList?.length || !supabase) return;
    
    try {
      // Get all event IDs
      const eventIds = eventsList.map(event => event.id);
      
      // Fetch the latest registration counts for all events
      const { data, error } = await supabase
        .from('events')
        .select('id, registered_count')
        .in('id', eventIds);
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Create a map of event ID to registered count
        const countMap = data.reduce((map, item) => {
          map[item.id] = item.registered_count || 0;
          return map;
        }, {});
        
        // Update the events with the latest counts
        setEvents(prevEvents => 
          prevEvents.map(event => ({
            ...event,
            registered_count: countMap[event.id] !== undefined ? countMap[event.id] : event.registered_count
          }))
        );
        
        console.log("Synced registration counts for all events");
      }
    } catch (error) {
      console.error('Error syncing registration counts:', error);
    }
  };

  // Set up real-time subscription for registration updates
  useEffect(() => {
    if (!events.length || !supabase) return;
    
    console.log("Setting up real-time subscriptions for events list");
    
    // Create a channel for event registrations
    const registrationsChannel = supabase
      .channel('event-registrations-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (INSERT, DELETE)
          schema: 'public',
          table: 'event_registrations'
        },
        async (payload) => {
          console.log('Event registration change detected:', payload);
          
          // Get the event ID from the payload
          const eventId = payload.new?.event_id || payload.old?.event_id;
          if (!eventId) return;
          
          // Check if this event is in our current list
          const eventIndex = events.findIndex(e => e.id === eventId);
          if (eventIndex === -1) return;
          
          // Sync registration counts when a change is detected
          syncRegistrationCounts(events);
        }
      )
      .subscribe();
    
    // Create a channel for events table updates
    const eventsChannel = supabase
      .channel('events-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // Listen for updates
          schema: 'public',
          table: 'events',
          filter: `id=in.(${events.map(e => e.id).join(',')})`
        },
        async (payload) => {
          console.log('Event update detected:', payload);
          
          if (payload.new && payload.new.registered_count !== undefined) {
            // Update the specific event in our state
            setEvents(prevEvents => 
              prevEvents.map(event => 
                event.id === payload.new.id 
                  ? { ...event, registered_count: payload.new.registered_count }
                  : event
              )
            );
            
            console.log(`Updated event ${payload.new.id} registration count to ${payload.new.registered_count}`);
          }
        }
      )
      .subscribe();
    
    // Clean up subscriptions when component unmounts
    return () => {
      console.log("Cleaning up events list subscriptions");
      supabase.channel('event-registrations-updates').unsubscribe();
      supabase.channel('events-updates').unsubscribe();
    };
  }, [events, supabase]);

  // Filter and search events
  useEffect(() => {
    if (!events.length) {
      setFilteredEvents([]);
      return;
    }
    
    const filtered = events.filter(event => {
      // Apply status filter
      const statusMatch = filter === 'all' || 
        event.status?.toLowerCase() === filter.toLowerCase();
      
      // Apply search query if present
      const searchMatch = !searchQuery || (
        (event.title?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.game?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.location?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      
      return statusMatch && searchMatch;
    });
    
    setFilteredEvents(filtered);
  }, [events, filter, searchQuery]);

  return (
    <>
      <Head>
        <title>Gaming Events & Tournaments | Merrouch Gaming Center</title>
      </Head>
      <ProtectedPageWrapper>
              {/* DynamicMeta removed - metadata now handled in _document.js */}

      <div className={styles.container}>
        {/* Page heading (h1) */}
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Gaming Events & Tournaments</h1>
        </header>
        
        {/* Browse Events section with search and filters */}
        <div className={styles.eventsHeader}>
          <h2 className={styles.sectionTitle}>Browse Events</h2>
        </div>
        
        <div className={styles.searchAndFilters}>
          <div className={styles.searchContainer}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className={styles.clearSearch}
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          <div className={styles.filtersWrapper}>
            <div className={styles.filtersDesktop}>
              <button 
                className={`${styles.filterButton} ${filter === 'all' ? styles.filterActive : ''}`}
                onClick={() => setFilter('all')}
              >
                All Events
              </button>
              <button 
                className={`${styles.filterButton} ${filter === 'upcoming' ? styles.filterActive : ''}`}
                onClick={() => setFilter('upcoming')}
              >
                Upcoming
              </button>
              <button 
                className={`${styles.filterButton} ${filter === 'in progress' ? styles.filterActive : ''}`}
                onClick={() => setFilter('in progress')}
              >
                In Progress
              </button>
              <button 
                className={`${styles.filterButton} ${filter === 'completed' ? styles.filterActive : ''}`}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
            </div>
            
            <button 
              className={styles.mobileFilterButton}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FaFilter /> Filter
            </button>
            
            {showFilters && (
              <div className={styles.mobileFilters}>
                <button 
                  className={`${styles.filterButton} ${filter === 'all' ? styles.filterActive : ''}`}
                  onClick={() => { setFilter('all'); setShowFilters(false); }}
                >
                  All Events
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'upcoming' ? styles.filterActive : ''}`}
                  onClick={() => { setFilter('upcoming'); setShowFilters(false); }}
                >
                  Upcoming
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'in progress' ? styles.filterActive : ''}`}
                  onClick={() => { setFilter('in progress'); setShowFilters(false); }}
                >
                  In Progress
                </button>
                <button 
                  className={`${styles.filterButton} ${filter === 'completed' ? styles.filterActive : ''}`}
                  onClick={() => { setFilter('completed'); setShowFilters(false); }}
                >
                  Completed
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Events grid with filtered events */}
        {loading ? (
          <LoadingSpinner />
        ) : filteredEvents.length === 0 ? (
          <div className={styles.emptyContainer}>
            <div className={styles.emptyIcon}>🎮</div>
            <h2>No Events Found</h2>
            {searchQuery ? (
              <p>No events matching your search: "{searchQuery}"</p>
            ) : (
              <p>There are no events matching your current filter.</p>
            )}
            <div className={styles.emptyActions}>
              {searchQuery && (
                <button 
                  className={styles.resetButton}
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </button>
              )}
              {filter !== 'all' && (
                <button 
                  className={styles.resetButton}
                  onClick={() => setFilter('all')}
                >
                  View All Events
                </button>
              )}
            </div>
          </div>
        ) : (
          <motion.div 
            className={styles.eventsGrid}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </motion.div>
        )}
      </div>
    </ProtectedPageWrapper>
    </>
  );
}

function EventCard({ event }) {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isPublicView = !user;
  const { openLoginModal } = useModal();
  
  // Only check registration status if user is logged in
  useEffect(() => {
    // Don't run the check for non-authenticated users
    if (!user || !event) {
      setCheckingRegistration(false);
      return;
    }
    
    // Don't check registration status for completed events
    if (event.status === 'Completed') {
      setCheckingRegistration(false);
      return;
    }
    
    const checkRegistrationStatus = async () => {
      try {
        setCheckingRegistration(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          setCheckingRegistration(false);
          return;
        }
        
        const response = await fetch(`/api/events/register?eventId=${event.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsRegistered(data.isRegistered);
        }
      } catch (error) {
        console.error('Error checking registration status:', error);
      } finally {
        setCheckingRegistration(false);
      }
    };
    
    checkRegistrationStatus();
  }, [user, event, supabase]);
  
  // Extract registration count from event
  const registeredCount = event.registered_count || 0;
  
  const getBadgeContainerClass = () => {
    // Calculate if event is full
    const isFull = 
      event.registration_limit !== null && 
      registeredCount >= event.registration_limit;
    
    // Status-based classes
    if (event.status === 'Completed') {
      return styles.completedBadges;
    } else if (event.status === 'In Progress') {
      return styles.progressBadges;
    } else if (isFull) {
      return styles.fullBadges;
    } else {
      return styles.normalBadges;
    }
  };
  
  const truncateDescription = (text, maxLength = 120) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  const handleRegisterClick = () => {
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
    router.push(`/events/${event.id}`);
  };
  
  const viewEventDetails = () => {
    if (isLoading) return; // Prevent multiple clicks
    
    setIsLoading(true); // Set loading state to true
    router.push(`/events/${event.id}`);
  };

  // Get registration button text
  const getRegistrationButtonText = () => {
    // For completed events, always show "View Results"
    if (event.status === 'Completed') {
      return 'View Results';
    }
    
    // For in-progress events, always show "In Progress"
    if (event.status === 'In Progress') {
      return 'View Tournament';
    }
    
    // Only show loading state if user is logged in and we're checking registration
    if (!isPublicView && checkingRegistration) {
      return 'Loading...';
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return 'Registration Full';
    }
    
    // For public users on upcoming events
    if (isPublicView) {
      return event.status === 'Upcoming' ? 'Login to Register' : 'View Event';
    }
    
    // For authenticated users
    return isRegistered ? 'Already Registered' : 'Register Now';
  };
  
  // Get registration button class
  const getRegistrationButtonClass = () => {
    const baseClass = styles.registerButton;
    
    // For completed events
    if (event.status === 'Completed') {
      return `${baseClass} ${styles.completedButton}`;
    }
    
    // For in-progress events
    if (event.status === 'In Progress') {
      return `${baseClass} ${styles.inProgressButton}`;
    }
    
    // Only show loading state if user is logged in and we're checking registration
    if (!isPublicView && checkingRegistration) {
      return `${baseClass} ${styles.loadingButton}`;
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return `${baseClass} ${styles.fullButton}`;
    }
    
    // For authenticated users who are registered
    if (!isPublicView && isRegistered) {
      return `${baseClass} ${styles.registeredButton} ${styles.nonClickable}`;
    }
    
    // Default case
    return baseClass;
  };

  return (
    <div 
      className={`${styles.eventCard} ${styles.clickableCard} ${isLoading ? styles.eventCardLoading : ''}`}
      onClick={viewEventDetails}
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
        
        {/* Badge container with black background */}
        <div className={`${styles.badgeContainer} ${getBadgeContainerClass()}`}>
          {/* Status badge - always present */}
          <div className={`${styles.eventStatusBadge} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
            {event.status || 'Upcoming'}
          </div>
          
          {/* Event mode badge - if available */}
          {event.team_type && (
            <div className={`${styles.eventModeBadge} ${styles[`mode${event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}`]}`}>
              {event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}
            </div>
          )}
          
          {/* Registered badge - if registered and upcoming */}
          {isRegistered && event.status === 'Upcoming' && (
            <div className={styles.registeredBadge}>
              <span className={styles.checkmark}>✓</span> Registered
            </div>
          )}
        </div>
        
        {/* Add date badge */}
        {event.date && (
          <div className={styles.dateBadge}>
            <div className={styles.dateMonth}>
              {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
            </div>
            <div className={styles.dateDay}>
              {new Date(event.date).toLocaleDateString('en-US', { day: 'numeric' })}
            </div>
          </div>
        )}
      </div>
      <div className={`${styles.eventContent} ${styles.forceRepaint}`}>
        <h3 className={styles.eventTitle}>
          {event.title}
          {event.game && (
            <span className={styles.eventGameLabel}>{event.game}</span>
          )}
        </h3>

        <div className={styles.eventMeta}>
          <div className={styles.eventTime}>
            <FaCalendarAlt className={styles.metaIcon} /> {event.time}
          </div>
          <div className={styles.eventLocation}>
            <span className={styles.metaIcon}>📍</span> {event.location}
          </div>
          {event.registration_limit && (
            <div className={styles.eventRegistrations}>
              <span className={styles.metaIcon}>👥</span> 
              <div className={styles.registrationProgress}>
                <div className={styles.progressBarContainer}>
                  <div 
                    className={styles.progressBar}
                    style={{ 
                      width: `${Math.min(100, (registeredCount / event.registration_limit) * 100)}%`,
                      backgroundColor: registeredCount >= event.registration_limit ? '#dc3545' : '#28a745'
                    }}
                  ></div>
                </div>
                <span className={styles.registrationCount}>
                  {registeredCount}/{event.registration_limit}
                </span>
              </div>
            </div>
          )}
        </div>
        
        <p className={styles.eventDescription}>
          {truncateDescription(event.description)}
        </p>
      </div>

      {/* Event actions with stopPropagation to prevent triggering the card click */}
      <div className={styles.eventActions} onClick={(e) => e.stopPropagation()}>
        <button 
          className={getRegistrationButtonClass()}
          onClick={(e) => {
            e.stopPropagation();
            setIsLoading(true); // Show loading animation
            handleRegisterClick();
          }}
          disabled={
            (!isPublicView && checkingRegistration) ||
            (!isPublicView && isRegistered)
          }
        >
          {getRegistrationButtonText()}
        </button>
      </div>
    </div>
  );
} 