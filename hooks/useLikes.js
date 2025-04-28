import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { createClient } from '../utils/supabase/component';

export function useLikes(clipId, initialCount = 0, currentUser = null) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const likesCache = useRef(new Map());

  const fetchLikes = useCallback(async () => {
    if (!clipId) return;
    
    setIsLoadingLikes(true);
    
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
    }
  }, [clipId]);

  const handleLike = useCallback(async () => {
    if (!currentUser?.id || !clipId) return Promise.reject('No user or clip ID');
    if (isUpdatingLike) return Promise.reject('Already updating');

    setIsUpdatingLike(true);
    const supabase = createClient();
    const newLikedState = !liked;
    
    // Store the current count for potential rollback
    const prevCount = likesCount;
    
    // Optimistically update the count
    if (!liked) {
      // Liking - increment count
      setLikesCount(prev => prev + 1);
    } else {
      // Unliking - decrement count
      setLikesCount(prev => Math.max(0, prev - 1));
    }

    try {
      if (liked) {
        // Unlike
        const { error } = await supabase
          .from('video_likes')
          .delete()
          .match({ 
            clip_id: clipId, 
            user_id: currentUser.id 
          });

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('video_likes')
          .insert({ 
            clip_id: clipId, 
            user_id: currentUser.id 
          });

        if (error) throw error;
      }

      // Update the liked state
      setLiked(newLikedState);
      
      // Fetch updated likes in the background without blocking
      fetchLikes().catch(err => console.error('Error fetching likes after update:', err));
      
      return Promise.resolve(true);
    } catch (error) {
      console.error('Error updating like status:', error);
      // Revert the optimistic count update on error
      setLikesCount(prevCount);
      return Promise.reject(error);
    } finally {
      setIsUpdatingLike(false);
    }
  }, [clipId, currentUser?.id, liked, isUpdatingLike, fetchLikes, likesCount]);

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
    fetchLikes();
  }, [clipId, currentUser?.id, fetchLikes]);

  useEffect(() => {
    if (!clipId) return;

    const supabase = createClient();
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
        () => {
          fetchLikes(); // Refresh on changes
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [clipId, fetchLikes]);

  return {
    liked,
    setLiked,
    likesCount,
    isUpdatingLike,
    likesList,
    handleLike,
    fetchLikes
  };
} 