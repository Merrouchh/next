import { useState, useEffect, useCallback, useRef } from 'react';

export const useClipsFeed = (
  supabase, 
  CLIPS_PER_PAGE = 5, 
  username = null, 
  isOwner = false,
  initialClips = [],
  totalClips = 0,
  isLoggedIn = false
) => {
  const [clips, setClips] = useState(Array.isArray(initialClips) ? initialClips : []);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const loaderRef = useRef(null);

  // 1. Cache signed URLs
  const urlCache = useRef(new Map());
  
  // 2. Debounce search
  const searchDebounce = useRef(null);

  // Add request cancellation
  const abortController = useRef(null);

  const isLoadingRef = useRef(false);
  const currentUsername = useRef(username);

  // Track if this is the first load
  const isFirstLoad = useRef(true);

  // Track previous logged in state
  const prevIsLoggedIn = useRef(isLoggedIn);

  const fetchClips = useCallback(async () => {
    if (isLoadingRef.current || !username) return;
    
    isLoadingRef.current = true;
    // Only set loading true if we have no clips yet
    if (clips.length === 0) {
      setLoading(true);
    }

    try {
      // First get total count for this query
      const { count } = await supabase
        .from('clips')
        .select('id', { count: 'exact', head: true })
        .eq('username', username)
        .eq('visibility', isOwner ? undefined : 'public');

      // Adjust the range for first load to get all clips up to CLIPS_PER_PAGE
      const rangeStart = isFirstLoad.current ? 0 : page * CLIPS_PER_PAGE;
      const rangeEnd = isFirstLoad.current 
        ? CLIPS_PER_PAGE - 1 
        : (page + 1) * CLIPS_PER_PAGE - 1;

      let query = supabase
        .from('clips')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .range(rangeStart, rangeEnd);

      if (username) {
        query = query.eq('username', username);
      }

      if (!isOwner && !isLoggedIn) {
        query = query.eq('visibility', 'public');
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setClips(prev => {
          const prevClips = Array.isArray(prev) ? prev : [];
          if (page === 0 || isFirstLoad.current) {
            isFirstLoad.current = false;
            return Array.isArray(data) ? data : [];
          }
          const uniqueClips = new Set([...prevClips, ...(Array.isArray(data) ? data : [])].map(clip => JSON.stringify(clip)));
          return Array.from(uniqueClips).map(str => JSON.parse(str));
        });

        // Check if we have more clips to load
        const totalLoaded = isFirstLoad.current ? data.length : (page + 1) * CLIPS_PER_PAGE;
        setHasMore(totalLoaded < count);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching clips:', error);
      if (clips.length === 0) {
        setClips([]);
      }
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [supabase, page, CLIPS_PER_PAGE, username, isOwner, isLoggedIn, clips.length]);

  // Single intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoadingRef.current) {
          fetchClips();
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [hasMore, fetchClips]);

  // Initial load - Only fetch if no initial clips provided
  useEffect(() => {
    if (initialClips.length > 0) {
      setLoading(false);
      return;
    }

    const initialFetch = async () => {
      if (!username) return;
      
      setPage(0);
      setClips([]);
      await fetchClips();
    };
    
    initialFetch();
  }, [username, initialClips.length]);

  const updateClipCount = useCallback((clipId, field, newCount) => {
    setClips(prev => 
      prev.map(clip => 
        clip.id === clipId ? { ...clip, [field]: newCount } : clip
      )
    );
  }, []);

  // Debounce search
  const searchClips = useCallback((term) => {
    if (searchDebounce.current) {
      clearTimeout(searchDebounce.current);
    }

    searchDebounce.current = setTimeout(() => {
      setSearchTerm(term);
      setPage(0);
      setClips([]);
    }, 300);
  }, []);

  // Clear debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchDebounce.current) {
        clearTimeout(searchDebounce.current);
      }
    };
  }, []);

  // Clear cache on unmount
  useEffect(() => {
    return () => {
      urlCache.current.clear();
    };
  }, []);

  // Clear request cancellation on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Reset everything when username or auth state changes
  useEffect(() => {
    if (currentUsername.current === username && prevIsLoggedIn.current === isLoggedIn) return;
    currentUsername.current = username;
    prevIsLoggedIn.current = isLoggedIn;
    
    setClips([]);
    setPage(0);
    setHasMore(true);
    isLoadingRef.current = false;
    isFirstLoad.current = true;
    
    if (username) {
      fetchClips();
    }
  }, [username, isLoggedIn, fetchClips]);

  // Add back the resetClips function
  const resetClips = useCallback(() => {
    setClips([]);
    setPage(0);
    setHasMore(true);
    isLoadingRef.current = false;
    isFirstLoad.current = true;
  }, []);

  return {
    clips: Array.isArray(clips) ? clips : [],
    loading,
    hasMore,
    loaderRef,
    setClips,
    updateClipCount,
    searchClips,
    resetClips,
    fetchClips
  };
}; 