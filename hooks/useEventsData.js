import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

// iOS detection utility
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const useEventsData = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, supabase, session } = useAuth();

  // Fetch events function
  const fetchEvents = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      // Fetch events data (public endpoint, no auth needed)
      const response = await fetch('/api/events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
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
      setError(error.message);
      toast.error('Failed to load events. Please try again later.');
      setEvents([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user, session]);

  // Function to sync registration counts with the database
  const syncRegistrationCounts = useCallback(async (eventsList) => {
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
      }
    } catch (error) {
      console.error('Error syncing registration counts:', error);
    }
  }, [supabase]);

  // Set up real-time subscription for registration updates
  useEffect(() => {
    if (!events.length || !supabase || !user) return; // Only set up subscriptions for authenticated users
    
    // Detect if device might be old (simplified check)
    const isOldDevice = isIOS() && /OS [5-9]_/.test(navigator.userAgent);
    
    // Create a single channel for all updates (more efficient than multiple channels)
    const channel = supabase
      .channel('events-updates-combined')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_registrations'
        },
        async (payload) => {
          // Get the event ID from the payload
          const eventId = payload.new?.event_id || payload.old?.event_id;
          if (!eventId) return;
          
          // Check if this event is in our current list
          const eventIndex = events.findIndex(e => e.id === eventId);
          if (eventIndex === -1) return;
          
          // For old devices, use a debounced approach
          if (isOldDevice) {
            setTimeout(() => syncRegistrationCounts(events), 1000);
          } else {
            syncRegistrationCounts(events);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=in.(${events.map(e => e.id).join(',')})`
        },
        async (payload) => {
          if (payload.new && payload.new.registered_count !== undefined) {
            // Update the specific event in our state
            setEvents(prevEvents => 
              prevEvents.map(event => 
                event.id === payload.new.id 
                  ? { ...event, registered_count: payload.new.registered_count }
                  : event
              )
            );
          }
        }
      )
      .subscribe();
    
    // Sync registration counts when the component mounts
    syncRegistrationCounts(events);
    
    // Set up a less aggressive periodic sync for old devices
    const intervalMs = isOldDevice ? 30000 : 10000; // 30s for old devices, 10s for newer ones
    const intervalId = setInterval(() => syncRegistrationCounts(events), intervalMs);
    
    // Clean up subscription when component unmounts
    return () => {
      supabase.channel('events-updates-combined').unsubscribe();
      clearInterval(intervalId);
    };
  }, [events, supabase, user]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Refresh function for manual refresh
  const refreshData = useCallback((forceRefresh = false) => {
    fetchEvents(forceRefresh);
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    isRefreshing,
    refreshData,
    syncRegistrationCounts
  };
}; 