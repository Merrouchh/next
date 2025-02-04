import { useState, useEffect, useCallback, useRef } from 'react';

export const useClipsFeed = (supabase, CLIPS_PER_PAGE = 5, username = null, isOwner = false) => {
  const [loading, setLoading] = useState(true);
  const [clips, setClips] = useState([]);
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
    let mounted = true;
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    try {
      let query = supabase
        .from('clips')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .range(page * CLIPS_PER_PAGE, (page + 1) * CLIPS_PER_PAGE - 1);

      if (username) {
        query = query.eq('username', username);
        if (!isOwner) {
          query = query.eq('visibility', 'public');
        }
      } else {
        query = query.eq('visibility', 'public');
      }

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (!mounted) return;
      if (error) throw error;

      const clipsWithUrls = await Promise.all(data.map(async (clip) => {
        if (!mounted) return null;
        if (!clip?.file_path) return null;
        
        // Check cache first
        if (urlCache.current.has(clip.file_path)) {
          return {
            ...clip,
            ...urlCache.current.get(clip.file_path)
          };
        }
        
        const [videoUrl, thumbnailUrl] = await Promise.all([
          supabase.storage
            .from('highlight-clips')
            .createSignedUrl(clip.file_path, 3600),
          clip.thumbnail_path ? 
            supabase.storage
              .from('highlight-clips')
              .createSignedUrl(clip.thumbnail_path, 3600) : 
            Promise.resolve(null)
        ]);

        const urls = {
          url: videoUrl?.data?.signedUrl,
          thumbnailUrl: thumbnailUrl?.data?.signedUrl || videoUrl?.data?.signedUrl
        };

        // Cache the URLs
        urlCache.current.set(clip.file_path, urls);
        
        return {
          ...clip,
          ...urls
        };
      }));

      if (!mounted) return;
      const validClips = clipsWithUrls.filter(Boolean);
      setClips(prev => page === 0 ? validClips : [...prev, ...validClips]);
      setHasMore(validClips.length === CLIPS_PER_PAGE);
      setLoading(false);
    } catch (err) {
      if (!mounted || err.name === 'AbortError') return;
      console.error('Error fetching clips:', err);
      setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [page, supabase, CLIPS_PER_PAGE, username, searchTerm, isOwner]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prevPage) => prevPage + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading]);

  const updateClipCount = useCallback((clipId, field, newCount) => {
    setClips(prevClips => prevClips.map(c => 
      c.id === clipId ? { ...c, [field]: newCount } : c
    ));
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
    updateClipCount,
    searchClips,
    setClips
  };
}; 