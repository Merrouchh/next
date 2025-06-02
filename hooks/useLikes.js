import { useState, useEffect, useRef, useCallback } from 'react';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';
import { createClient } from '../utils/supabase/component';

export function useLikes(clipId, initialCount = 0, currentUser = null) {
  console.log(`🔔 useLikes called for clip ${clipId} with initialCount: ${initialCount}, user: ${currentUser?.id || 'anonymous'}`);
  
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(initialCount || 0);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likesList, setLikesList] = useState([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const likesCache = useRef(new Map());
  const subscriptionRef = useRef(null);
  const mountedRef = useRef(true);

  // Initialize likes count properly
  useEffect(() => {
    console.log(`🔔 Initial count changed for clip ${clipId}: ${initialCount}`);
    if (typeof initialCount === 'number' && initialCount >= 0) {
      setLikesCount(initialCount);
    }
  }, [initialCount, clipId]);

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

      console.log(`🔔 Fetched likes data for clip ${clipId}:`, likesData);

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

        console.log(`✅ Setting ${formattedLikes.length} likes for clip ${clipId}`);
        setLikesList(formattedLikes);
        setLikesCount(formattedLikes.length);
        return formattedLikes;
      } else {
        console.log(`📭 No likes found for clip ${clipId}, setting count to 0`);
        setLikesList([]);
        setLikesCount(0);
        return [];
      }
    } catch (error) {
      console.error(`❌ Error fetching likes for clip ${clipId}:`, error);
      setLikesList([]);
      setLikesCount(0);
      return [];
    } finally {
      setIsLoadingLikes(false);
    }
  }, [clipId, initialCount]);

  const handleLike = useCallback(async () => {
    if (!currentUser?.id || !clipId || isUpdatingLike) return false;

    setIsUpdatingLike(true);
    
    // Optimistic update - immediately update UI
    const wasLiked = liked;
    const previousCount = likesCount;
    const previousLikesList = [...likesList];
    
    console.log(`🔔 Like button clicked for clip ${clipId}, current state: liked=${liked}, count=${likesCount}`);
    
    // Optimistically update the UI
    const newLiked = !liked;
    setLiked(newLiked);
    
    if (newLiked) {
      // User is liking - add them to the list immediately
      const optimisticLike = {
        id: `temp_${Date.now()}`, // Temporary ID
        userId: currentUser.id,
        username: currentUser.username || currentUser.email?.split('@')[0] || 'You',
        createdAt: new Date().toISOString()
      };
      setLikesList([optimisticLike, ...likesList]);
      setLikesCount(likesCount + 1);
      console.log(`✨ Optimistically added like for user ${currentUser.username}`);
    } else {
      // User is unliking - remove them from the list immediately
      const updatedList = likesList.filter(like => like.userId !== currentUser.id);
      setLikesList(updatedList);
      setLikesCount(likesCount - 1);
      console.log(`✨ Optimistically removed like for user ${currentUser.username}`);
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
      
      console.log(`✅ Like API response for clip ${clipId}:`, data);
      
      // Update with the actual server response (should match our optimistic update)
      setLiked(data.action === 'added');
      
      // Update the like count from server
      if (data.count !== undefined) {
        setLikesCount(data.count);
        console.log(`🔄 Updated count from server: ${data.count}`);
      }
      
      // Always refresh the likes list to get the most up-to-date data with usernames
      // This will replace our optimistic entry with the real data
      setTimeout(() => {
        fetchLikes();
      }, 50); // Small delay to ensure the database is updated
      
      return true;
    } catch (error) {
      console.error(`❌ Error updating like for clip ${clipId}:`, error);
      
      // Revert optimistic update on error
      setLiked(wasLiked);
      setLikesCount(previousCount);
      setLikesList(previousLikesList);
      console.log(`🔄 Reverted optimistic update due to error`);
      return false;
    } finally {
      setIsUpdatingLike(false);
    }
  }, [clipId, currentUser?.id, isUpdatingLike, liked, likesCount, likesList, fetchLikes]);

  useEffect(() => {
    console.log(`🔔 Initializing likes for clip ${clipId}, initialCount: ${initialCount}`);
    
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
          console.log(`🔔 User like status for clip ${clipId}: ${!!data}`);
        } catch (error) {
          console.error(`❌ Error checking initial like status for clip ${clipId}:`, error);
        }
      }
    };

    checkInitialLikeStatus();
    fetchLikes();
  }, [clipId, currentUser?.id, fetchLikes, initialCount]);

  useEffect(() => {
    if (!clipId) return;

    // Clean up any existing subscription first
    if (subscriptionRef.current) {
      console.log(`🔌 Cleaning up existing subscription for clip ${clipId}`);
      try {
        const supabase = createClient();
        supabase.removeChannel(subscriptionRef.current);
      } catch (error) {
        console.log('Error removing previous subscription:', error);
      }
      subscriptionRef.current = null;
    }

    console.log(`🔔 Setting up video likes subscription for clip ${clipId}`);
    
    const supabase = createClient();
    const subscription = supabase
      .channel(`video_likes:${clipId}:${Date.now()}`) // Add timestamp to make it unique
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_likes',
          filter: `clip_id=eq.${clipId}`
        },
        (payload) => {
          if (!mountedRef.current) return;
          
          console.log(`🔔 Video likes change detected for clip ${clipId}:`, payload);
          
          // Handle real-time updates more smoothly
          if (payload.eventType === 'INSERT') {
            // Someone liked the video
            console.log(`👍 New like added for clip ${clipId}`);
            fetchLikes(); // Refresh to get the complete data with usernames
          } else if (payload.eventType === 'DELETE') {
            // Someone unliked the video
            console.log(`👎 Like removed for clip ${clipId}`);
            fetchLikes(); // Refresh to get the updated data
          } else {
            // For other events, just refresh
            setTimeout(() => {
              if (mountedRef.current) {
                fetchLikes();
              }
            }, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔔 Video likes subscription status for clip ${clipId}:`, status);
        
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Successfully subscribed to video likes for clip ${clipId}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.log(`❌ Video likes subscription failed for clip ${clipId}:`, status);
          
          // Try to re-establish subscription after a delay
          setTimeout(() => {
            if (mountedRef.current) {
              console.log(`🔄 Retrying video likes subscription for clip ${clipId}`);
              fetchLikes();
            }
          }, 2000);
        }
      });

    subscriptionRef.current = subscription;

    return () => {
      console.log(`🔌 Unsubscribing from video likes for clip ${clipId}`);
      if (subscriptionRef.current) {
        try {
          supabase.removeChannel(subscriptionRef.current);
        } catch (error) {
          console.log('Error removing likes subscription:', error);
        }
        subscriptionRef.current = null;
      }
    };
  }, [clipId, fetchLikes]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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