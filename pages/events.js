import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { FaSearch, FaFilter } from 'react-icons/fa';
import styles from '../styles/Events.module.css';
import ProtectedPageWrapper from '../components/ProtectedPageWrapper';
import OptimizedEventCard from '../components/events/OptimizedEventCard';
import { LoadingSpinner, EmptyEventsState } from '../components/events/EventsPageComponents';
import { useEventsData } from '../hooks/useEventsData';
import { createClient } from '@supabase/supabase-js';



export async function getServerSideProps({ res }) {
  // Disable all caching - always fresh data
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Default fallback image
  let previewImage = "https://merrouchgaming.com/top.jpg";
  
  try {
    // Check if environment variables are defined
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      // Import Supabase server-side client
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

const OptimizedEvents = React.memo(() => {
  // State management - consolidated
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);

  // Custom hook for events data
  const { events, loading, error, isRefreshing, refreshData } = useEventsData();

  // Mark the page as loaded after mount
  useEffect(() => {
    setPageLoaded(true);
  }, []);

  // Memoized filtered events to prevent unnecessary recalculations
  const filteredEvents = useMemo(() => {
    if (!events.length) {
      return [];
    }
    
    return events.filter(event => {
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
  }, [events, filter, searchQuery]);

  // Memoized handlers to prevent re-renders
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const resetFilter = useCallback(() => {
    setFilter('all');
  }, []);

  const handleFilterClick = useCallback((filterValue) => {
    setFilter(filterValue);
    setShowFilters(false);
  }, []);

  const toggleMobileFilters = useCallback(() => {
    setShowFilters(!showFilters);
  }, [showFilters]);

  // Filter buttons data - memoized to prevent recreation
  const filterButtons = useMemo(() => [
    { key: 'all', label: 'All Events' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'in progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' }
  ], []);

  return (
    <>
      <Head>
        <title>Gaming Events & Tournaments | Merrouch Gaming Center</title>
      </Head>
      <ProtectedPageWrapper>
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
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button 
                  className={styles.clearSearch}
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            
            <div className={styles.filtersWrapper}>
              <div className={styles.filtersDesktop}>
                {filterButtons.map(({ key, label }) => (
                  <button 
                    key={key}
                    className={`${styles.filterButton} ${filter === key ? styles.filterActive : ''}`}
                    onClick={() => handleFilterClick(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              
              <button 
                className={styles.mobileFilterButton}
                onClick={toggleMobileFilters}
              >
                <FaFilter /> Filter
              </button>
              
              {showFilters && (
                <div className={styles.mobileFilters}>
                  {filterButtons.map(({ key, label }) => (
                    <button 
                      key={key}
                      className={`${styles.filterButton} ${filter === key ? styles.filterActive : ''}`}
                      onClick={() => handleFilterClick(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Events grid with filtered events */}
          {loading ? (
            <LoadingSpinner />
          ) : filteredEvents.length === 0 ? (
            <EmptyEventsState
              searchQuery={searchQuery}
              filter={filter}
              onClearSearch={clearSearch}
              onResetFilter={resetFilter}
            />
          ) : (
            <motion.div 
              className={styles.eventsGrid}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {filteredEvents.map(event => (
                <OptimizedEventCard key={event.id} event={event} />
              ))}
            </motion.div>
          )}
        </div>
      </ProtectedPageWrapper>
    </>
  );
});

OptimizedEvents.displayName = 'OptimizedEvents';

export default OptimizedEvents;

 