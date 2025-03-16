import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import styles from '../styles/Events.module.css';
import { useAuth } from '../contexts/AuthContext';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import { toast } from 'react-hot-toast';

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

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { user, supabase } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        // Get the session for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) {
          throw new Error('Authentication token not available');
        }
        
        const response = await fetch('/api/events', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const data = await response.json();
        setEvents(data);
        
        // Sync registration counts for all events
        syncRegistrationCounts(data);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events. Please try again later.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchEvents();
    }
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

  // Filter events based on status
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.status?.toLowerCase() === filter.toLowerCase();
  });

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Events | MerrouchGaming</title>
        <meta name="description" content="Browse and register for gaming events" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Gaming Events</h1>
          <div className={styles.filters}>
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
        </div>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <p>Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className={styles.emptyContainer}>
            <div className={styles.emptyIcon}>🎮</div>
            <h2>No Events Found</h2>
            <p>There are no events matching your current filter.</p>
            {filter !== 'all' && (
              <button 
                className={styles.resetButton}
                onClick={() => setFilter('all')}
              >
                View All Events
              </button>
            )}
          </div>
        ) : (
          <div className={styles.eventsGrid}>
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </ProtectedPageWrapper>
  );
}

function EventCard({ event }) {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingRegistration, setCheckingRegistration] = useState(true);
  
  // Check if user is registered for this event
  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!user || !event) return;
      
      try {
        setCheckingRegistration(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        if (!accessToken) return;
        
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
  }, [event, user, supabase]);
  
  // Get badge container class based on number of visible badges
  const getBadgeContainerClass = () => {
    // Count how many badges are visible
    let visibleBadges = 1; // Status badge is always visible
    
    if (event.team_type) {
      visibleBadges++;
    }
    
    if (isRegistered && event.status === 'Upcoming') {
      visibleBadges++;
    }
    
    // Return appropriate class
    if (visibleBadges === 1) {
      return styles.singleBadge;
    } else if (visibleBadges === 2) {
      return styles.twoBadges;
    } else {
      return styles.threeBadges;
    }
  };
  
  // Ensure registration count is a number
  const registeredCount = typeof event.registered_count === 'number' ? event.registered_count : 0;
  
  // Truncate description for display
  const truncateDescription = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength).trim() + '...';
  };

  const handleRegisterClick = () => {
    if (event.status === 'Completed') {
      toast.error('This event has already ended.');
      return;
    }
    
    if (event.status === 'In Progress') {
      toast.error('This event is currently in progress and registration is closed.');
      return;
    }
    
    // If already registered, don't do anything
    if (isRegistered) {
      return;
    }
    
    // For upcoming events, navigate to the event detail page
    router.push(`/events/${event.id}`);
  };
  
  const viewEventDetails = () => {
    router.push(`/events/${event.id}`);
  };

  // Get registration button text
  const getRegistrationButtonText = () => {
    if (checkingRegistration) {
      return 'Loading...';
    }
    
    if (event.status === 'Completed') {
      return 'Event Ended';
    }
    
    if (event.status === 'In Progress') {
      return 'In Progress';
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return 'Registration Full';
    }
    
    return isRegistered ? 'Already Registered' : 'Register Now';
  };
  
  // Get registration button class
  const getRegistrationButtonClass = () => {
    const baseClass = styles.registerButton;
    
    if (checkingRegistration) {
      return `${baseClass} ${styles.loadingButton}`;
    }
    
    if (event.status === 'Completed') {
      return `${baseClass} ${styles.completedButton}`;
    }
    
    if (event.status === 'In Progress') {
      return `${baseClass} ${styles.inProgressButton}`;
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return `${baseClass} ${styles.fullButton}`;
    }
    
    return isRegistered ? `${baseClass} ${styles.registeredButton} ${styles.nonClickable}` : baseClass;
  };

  return (
    <div className={styles.eventCard}>
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
              ✓ Registered
            </div>
          )}
        </div>
      </div>
      <div className={styles.eventContent}>
        <h3 className={styles.eventTitle}>{event.title}</h3>
        <div className={styles.eventMeta}>
          <div className={styles.eventDate}>
            <span className={styles.metaIcon}>📅</span> {formatDate(event.date)}
          </div>
          <div className={styles.eventTime}>
            <span className={styles.metaIcon}>⏰</span> {event.time}
          </div>
          <div className={styles.eventLocation}>
            <span className={styles.metaIcon}>📍</span> {event.location}
          </div>
          <div className={styles.eventGame}>
            <span className={styles.metaIcon}>🎮</span> {event.game || 'Various Games'}
          </div>
          {event.registration_limit && (
            <div className={styles.eventRegistrations}>
              <span className={styles.metaIcon}>👥</span> {registeredCount} / {event.registration_limit} spots
            </div>
          )}
        </div>
        <p className={styles.eventDescription}>
          {truncateDescription(event.description)}
        </p>
        <div className={styles.eventActions}>
          <button 
            className={getRegistrationButtonClass()}
            onClick={handleRegisterClick}
            disabled={event.status === 'Completed' || event.status === 'In Progress' || checkingRegistration}
          >
            {getRegistrationButtonText()}
          </button>
          <button 
            className={`${styles.readMoreButton} ${isRegistered ? styles.primaryAction : ''}`}
            onClick={viewEventDetails}
          >
            Read More
          </button>
        </div>
      </div>
    </div>
  );
} 