import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { createClient } from '../utils/supabase/component';

export function useLikes(clipId, initialCount = 0, currentUser = null) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [isConfirmingUpdate, setIsConfirmingUpdate] = useState(false);
  const likesCache = useRef(new Map());

  const fetchLikes = useCallback(async (isConfirmation = false) => {
    if (!clipId) return;
    
    // Only show loading for non-confirmation fetches
    if (!isConfirmation) {
      setIsLoadingLikes(true);
    } else {
      setIsConfirmingUpdate(true);
    }
    
    try {
      const supabase = createClient();
      
      const { data: likesData, error: likesError } = await supabase
        .from('video_likes')
        .select('id, user_id, created_at')
        .eq('clip_id', clipId)
        .order('created_at', { ascending: false });

      if (likesError) throw likesError;

      if (likesData && likesData.length > 0) {
        const userIds = likesData.map(like => like.user_id);

        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds);

        if (usersError) throw usersError;

        const formattedLikes = likesData.map(like => {
          const user = usersData?.find(u => u.id === like.user_id);
          const username = user ? user.username : 'Unknown User';
          
          return {
            id: like.id,
            userId: like.user_id,
            username,
            createdAt: like.created_at
          };
        });

        setLikesList(formattedLikes);
        setLikesCount(formattedLikes.length);
        return formattedLikes;
      } else {
        setLikesList([]);
        setLikesCount(0);
        return [];
      }
    } catch (error) {
      return [];
    } finally {
      setIsLoadingLikes(false);
      setIsConfirmingUpdate(false);
    }
  }, [clipId]);

  const handleLike = useCallback(async () => {
    if (!currentUser?.id || !clipId || isUpdatingLike) return false;

    // Store the current state for potential rollback
    const wasLiked = liked;
    const previousCount = likesCount;
    const previousList = [...likesList];

    setIsUpdatingLike(true);

    // Optimistic update
    setLiked(!wasLiked);
    setLikesCount(wasLiked ? previousCount - 1 : previousCount + 1);
    
    // If adding a like, optimistically add the current user to the list
    if (!wasLiked) {
      const optimisticLike = {
        id: `temp-${Date.now()}`,
        userId: currentUser.id,
        username: currentUser.username || currentUser.email?.split('@')[0] || 'You',
        createdAt: new Date().toISOString()
      };
      setLikesList([optimisticLike, ...previousList]);
    } else {
      // If removing a like, optimistically remove the current user from the list
      setLikesList(previousList.filter(like => like.userId !== currentUser.id));
    }

    try {
      // Use the API endpoint instead of directly calling the database
      const response = await fetch('/api/clips/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clipId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update like');
      }
      
      const data = await response.json();
      
      // Confirm the optimistic update with server response
      setLiked(data.action === 'added');
      
      // Update the like count with the confirmed count
      if (data.count !== undefined) {
        setLikesCount(data.count);
      }
      
      // Refresh the full likes list to get accurate data after a short delay (as confirmation)
      setTimeout(() => fetchLikes(true), 300);
      
      return true;
    } catch (error) {
      console.error('Error updating like:', error);
      
      // Rollback optimistic update on error
      setLiked(wasLiked);
      setLikesCount(previousCount);
      setLikesList(previousList);
      
      return false;
    } finally {
      setIsUpdatingLike(false);
    }
  }, [clipId, currentUser?.id, currentUser?.username, currentUser?.email, isUpdatingLike, liked, likesCount, likesList, fetchLikes]);

  useEffect(() => {
    const checkInitialLikeStatus = async () => {
      if (clipId && currentUser?.id) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('video_likes')
            .select('*')
            .eq('clip_id', clipId)
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (error) throw error;
          setLiked(!!data);
        } catch (error) {
          // Remove this line
        }
      }
    };

    checkInitialLikeStatus();
    fetchLikes(); // Initial fetch should show loading
  }, [clipId, currentUser?.id, fetchLikes]);

  useEffect(() => {
    if (!clipId) return;

    const supabase = createClient();
    let debounceTimer = null;

    const debouncedFetchLikes = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchLikes(); // This is for other users' changes, so show loading
      }, 500); // Wait 500ms before fetching to debounce rapid changes
    };

    const subscription = supabase
      .channel(`video_likes:${clipId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_likes',
          filter: `clip_id=eq.${clipId}`
        },
        (payload) => {
          console.log('Like change detected:', payload);
          
          // Only refresh if the change is from a different user to avoid 
          // conflicts with our own optimistic updates
          if (payload.new?.user_id !== currentUser?.id && payload.old?.user_id !== currentUser?.id) {
            debouncedFetchLikes();
          } else {
            // If it's our own change, just refresh after a short delay to confirm (without loading state)
            setTimeout(() => fetchLikes(true), 200);
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [clipId, currentUser?.id, fetchLikes]);

  return {
    liked,
    setLiked,
    likesCount,
    isUpdatingLike,
    isLoadingLikes,
    likesList,
    handleLike,
    fetchLikes
  };
} 