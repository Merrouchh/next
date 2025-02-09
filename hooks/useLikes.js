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

  // Define fetchLikes first since it's used by other functions
  const fetchLikes = useCallback(async () => {
    if (!clipId) return;
    
    setIsLoadingLikes(true);
    
    try {
      const supabase = createClient();
      
      // First get the likes with auth user IDs
      const { data: likesData, error: likesError } = await supabase
        .from('video_likes')
        .select('id, user_id, created_at')
        .eq('clip_id', clipId)
        .order('created_at', { ascending: false });

      if (likesError) throw likesError;
      console.log('Likes Data:', likesData); // Debug log

      if (likesData && likesData.length > 0) {
        const userIds = likesData.map(like => like.user_id);
        console.log('User IDs to look up:', userIds); // Debug log

        // Get usernames from public.users table
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', userIds);

        if (usersError) throw usersError;
        console.log('Users Data:', usersData); // Debug log

        // Combine the data
        const formattedLikes = likesData.map(like => {
          const user = usersData?.find(u => u.id === like.user_id);
          console.log('Found user:', user); // Additional debug log
          
          // Make sure we're accessing the username correctly
          const username = user ? user.username : 'Unknown User';
          console.log('Username:', username); // Additional debug log
          
          return {
            id: like.id,
            userId: like.user_id,
            username, // Use the username we extracted
            createdAt: like.created_at
          };
        });

        // Log the final formatted likes
        console.log('Formatted Likes:', formattedLikes);

        setLikesList(formattedLikes);
        setLikesCount(formattedLikes.length);
        return formattedLikes;
      } else {
        setLikesList([]);
        setLikesCount(0);
        return [];
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2)); // Detailed error log
      return [];
    } finally {
      setIsLoadingLikes(false);
    }
  }, [clipId]);

  // Then define handleLike which uses fetchLikes
  const handleLike = useCallback(async () => {
    if (!currentUser?.id || !clipId || isUpdatingLike) return false;

    setIsUpdatingLike(true);
    const supabase = createClient();

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

      setLiked(!liked);
      await fetchLikes(); // Refresh likes
      return true;
    } catch (error) {
      console.error('Error updating like:', error);
      return false;
    } finally {
      setIsUpdatingLike(false);
    }
  }, [clipId, currentUser?.id, liked, isUpdatingLike, fetchLikes]);

  // Check initial like status
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
          console.error('Error checking like status:', error);
        }
      }
    };

    checkInitialLikeStatus();
    fetchLikes();
  }, [clipId, currentUser?.id, fetchLikes]);

  // Subscribe to real-time updates
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