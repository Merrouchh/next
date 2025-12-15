import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProfileClips(username, isOwner, initialClips = []) {
  const [clips, setClips] = useState(initialClips);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { supabase, user } = useAuth();
  const CLIPS_PER_PAGE = 3;
  const lastLoadTime = useRef(Date.now());

  // Filter clips based on authentication status and ownership
  useEffect(() => {
    if (!user) {
      // When logged out, filter out private clips
      console.log('User logged out, filtering private clips');
      setClips(prevClips => prevClips.filter(clip => clip.visibility === 'public'));
    }
  }, [user]);

  // Subscribe to clip changes
  useEffect(() => {
    if (!username) return;

    console.log('Setting up clips subscription');
    const subscription = supabase
      .channel('clips_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clips',
          filter: `username=eq.${username}`
        },
        (payload) => {
          console.log('Clip change detected:', payload);

          if (payload.eventType === 'UPDATE') {
            setClips(prevClips => {
              // If not owner/logged in and clip is private, remove it
              if ((!isOwner || !user) && payload.new.visibility === 'private') {
                return prevClips.filter(clip => clip.id !== payload.new.id);
              }
              // Otherwise update the clip
              return prevClips.map(clip => 
                clip.id === payload.new.id ? payload.new : clip
              );
            });
          } else if (payload.eventType === 'DELETE') {
            setClips(prevClips => 
              prevClips.filter(clip => clip.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up clips subscription');
      supabase.removeChannel(subscription);
    };
  }, [username, isOwner, user, supabase]);

  // Reset clips when ownership changes
  useEffect(() => {
    console.log('Ownership changed, resetting clips');
    setClips(initialClips);
    setHasMore(true);
  }, [isOwner, initialClips]);

  const loadMoreClips = useCallback(async () => {
    if (loading || !hasMore || !username || Date.now() - lastLoadTime.current < 500) return;

    setLoading(true);
    const from = clips.length;
    const to = from + CLIPS_PER_PAGE - 1;

    try {
      let query = supabase
        .from('clips')
        .select('*')
        .eq('username', username)
        .order('uploaded_at', { ascending: false })
        .range(from, to);

      // If not owner or not logged in, only show public clips
      if (!isOwner || !user) {
        console.log('Loading public clips for:', username);
        query = query.eq('visibility', 'public');
      } else {
        console.log('Loading all clips for owner:', username);
      }

      const { data: newClips, error } = await query;
      if (error) throw error;

      if (newClips) {
        const existingIds = new Set(clips.map(clip => clip.id));
        const uniqueNewClips = newClips.filter(clip => !existingIds.has(clip.id));
        
        if (uniqueNewClips.length > 0) {
          console.log(`Loaded ${uniqueNewClips.length} new clips`);
          setClips(prev => [...prev, ...uniqueNewClips]);
          setHasMore(uniqueNewClips.length === CLIPS_PER_PAGE);
          lastLoadTime.current = Date.now();
        } else {
          console.log('No new clips found');
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading clips:', error);
    } finally {
      setLoading(false);
    }
  }, [clips, loading, hasMore, username, isOwner, user, supabase]);

  // Scroll handler
  useEffect(() => {
    let timeoutId = null;

    const handleScroll = () => {
      if (timeoutId || loading || !hasMore) return;

      timeoutId = setTimeout(() => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        const scrollPercentage = (scrollTop + windowHeight) / documentHeight * 100;
        
        if (scrollPercentage > 95) {
          console.log(`Scrolled ${scrollPercentage.toFixed(2)}% - Loading more clips`);
          loadMoreClips();
        }

        timeoutId = null;
      }, 150);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, hasMore, loadMoreClips]);

  return {
    clips,
    loading,
    hasMore,
    error: null
  };
} 