import React, { useState, useCallback } from 'react';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import styles from '../styles/ClipCard.module.css';

/**
 * A dedicated button component for liking/unliking clips with animations
 * 
 * This component manages its own animation state separately from the like state
 * to ensure smoother animations and transitions.
 */
const LikeButton = ({ 
  liked, 
  likesCount, 
  isUpdatingLike, 
  onLike, 
  user,
  showLikesModal
}) => {
  // Local state for animations
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState([]);

  // Enhanced like handler with multiple floating hearts animation
  const handleLikeWithAnimation = useCallback(() => {
    // Only animate if the user is logged in and not already liking/unliking
    if (!user || isUpdatingLike) return;
    
    // If not already liked, show the animation
    if (!liked) {
      // Start heart animation
      setIsHeartAnimating(true);
      
      // Create 5-7 random floating hearts for better visibility
      const numHearts = Math.floor(Math.random() * 3) + 5; // 5-7 hearts
      const newHearts = [];
      
      for (let i = 0; i < numHearts; i++) {
        // Create random positions and delays for each heart with narrower spread
        newHearts.push({
          id: `heart-${Date.now()}-${i}`,
          left: Math.random() * 16 - 8, // -8px to +8px from center (narrower spread)
          delay: Math.random() * 0.4, // 0 to 0.4s delay
          scale: 0.9 + Math.random() * 0.6, // 0.9 to 1.5 scale (larger hearts)
          rotation: (Math.random() * 40) - 20 // -20 to +20 degrees (less rotation)
        });
      }
      
      setFloatingHearts(newHearts);
      
      // Clear animation state after animation completes
      setTimeout(() => {
        setIsHeartAnimating(false);
        setFloatingHearts([]);
      }, 1500);
    }
    
    // Call the provided like handler
    onLike();
  }, [liked, isUpdatingLike, user, onLike]);

  return (
    <div className={styles.likeContainer}>
      <button 
        className={`${styles.statButton} ${liked ? styles.liked : ''} ${isHeartAnimating ? styles.heartAnimating : ''}`}
        onClick={handleLikeWithAnimation}
        disabled={!user || isUpdatingLike}
        aria-label={liked ? "Unlike" : "Like"}
      >
        {liked ? <FaHeart className={styles.likeIcon} /> : <FaRegHeart />}
        <span>{likesCount}</span>
      </button>
      
      {/* Floating hearts - positioned directly over the heart icon */}
      {floatingHearts.length > 0 && (
        <div 
          className={styles.floatingHeartsContainer}
          style={{
            // Position the container exactly over the heart icon in the button
            left: '4px',     // Adjusted to be directly over the heart icon
            top: '4px',      // Adjusted to be directly over the heart icon
            width: '18px',   // Width of heart icon
            height: '18px',  // Height of heart icon
            position: 'absolute' // Ensure absolute positioning
          }}
        >
          {floatingHearts.map(heart => (
            <FaHeart 
              key={heart.id}
              className={styles.floatingHeart}
              style={{
                left: `${heart.left}px`,  // Simplified positioning
                animationDelay: `${heart.delay}s`,
                transform: `scale(${heart.scale}) rotate(${heart.rotation}deg)`
              }}
            />
          ))}
        </div>
      )}
      
      {likesCount > 0 && (
        <button 
          className={styles.showLikesButton}
          onClick={showLikesModal}
        >
          View {likesCount > 1 ? 'likes' : 'like'}
        </button>
      )}
    </div>
  );
};

export default React.memo(LikeButton); 