import { useState, useEffect, useCallback, useRef } from 'react';

export const useClipsFeed = (supabase, CLIPS_PER_PAGE = 5, username = null, isOwner = false) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const loaderRef = useRef(null);

  // 1. Cache signed URLs
  const urlCache = useRef(new Map());
  
  // 2. Debounce search
  const searchDebounce = useRef(null);

  // Add request cancellation
  const abortController = useRef(null);

  const fetchClips = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('clips')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .range(page * CLIPS_PER_PAGE, (page + 1) * CLIPS_PER_PAGE - 1);

      if (username) {
        query = query.eq('username', username);
      }

      if (!isOwner) {
        query = query.eq('visibility', 'public');
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Use Set to ensure unique clips
        const uniqueClips = new Set([...clips, ...data].map(clip => JSON.stringify(clip)));
        const newClips = Array.from(uniqueClips).map(str => JSON.parse(str));
        setClips(newClips);
        setHasMore(data.length === CLIPS_PER_PAGE);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching clips:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, page, CLIPS_PER_PAGE, username, isOwner, loading, clips]);

  // Single intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading) {
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
  }, [hasMore, loading, fetchClips]);

  // Initial load
  useEffect(() => {
    fetchClips();
  }, []); // Run once on mount

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

  return {
    clips,
    loading,
    hasMore,
    loaderRef,
    setClips,
    updateClipCount,
    searchClips
  };
}; 