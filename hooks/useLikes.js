import { useState, useEffect } from 'react';
import { updateLike, checkLikeStatus, getLikesByClipId } from '../utils/supabase/clips';

export const useLikes = (initialLiked = false, initialCount = 0) => {
  const [liked, setLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isUpdatingLike, setIsUpdatingLike] = useState(false);
  const [likesList, setLikesList] = useState([]);

  const handleLike = async (clipId, userId) => {
    if (!userId || isUpdatingLike || !clipId) return false;
    
    const newLikedState = !liked;
    const currentCount = likesCount;
    
    setIsUpdatingLike(true);
    
    try {
      // Optimistic update
      setLiked(newLikedState);
      setLikesCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));

      // Make API call
      await updateLike(clipId, userId);
      
      return true;
    } catch (error) {
      console.error('Failed to update like:', error);
      // Revert on error
      setLiked(!newLikedState);
      setLikesCount(currentCount);
      return false;
    } finally {
      setIsUpdatingLike(false);
    }
  };

  const fetchLikes = async (clipId) => {
    if (!clipId) return;
    
    try {
      const likes = await getLikesByClipId(clipId);
      if (Array.isArray(likes)) {
        setLikesList(likes);
        setLikesCount(likes.length);
      }
    } catch (error) {
      console.error('Failed to fetch likes:', error);
    }
  };

  return {
    liked,
    setLiked,
    likesCount,
    setLikesCount,
    isUpdatingLike,
    likesList,
    setLikesList,
    handleLike,
    fetchLikes
  };
}; 