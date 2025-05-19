import { ACHIEVEMENTS } from './achievementDefinitions';

/**
 * Utility functions for achievements
 */

/**
 * Process and enhance raw achievements with user data status
 * @param {Array} achievementStatuses - Achievement statuses from database
 * @param {Object} userData - User profile data
 * @returns {Array} Enhanced achievements array with completion status
 */
export const processAchievements = (achievementStatuses, userData) => {
  return ACHIEVEMENTS.map(achievement => {
    const dbStatus = achievementStatuses[achievement.id] || {};
    
    // Create the enhanced achievement with data from DB
    const enhancedAchievement = {
      ...achievement,
      completed: dbStatus.completed || false,
      claimed: dbStatus.claimed || false,
      pending: dbStatus.pending || false,
      status: dbStatus.status || 'incomplete',
      date_completed: dbStatus.date_completed || null,
      date_claimed: dbStatus.date_claimed || null,
      // Use database was_notified field
      was_notified: dbStatus.was_notified || false
    };
    
    // Add progress for achievements that track it
    if (achievement.getProgress) {
      enhancedAchievement.progress = achievement.getProgress(userData);
    }
    
    return enhancedAchievement;
  });
};

/**
 * Find achievements that should be completed based on user data but aren't yet marked as completed
 * @param {Array} achievements - Current achievements array
 * @param {Object} userData - User profile data 
 * @returns {Array} IDs of achievements that should be newly completed
 */
export const findNewlyCompletedAchievements = (achievements, userData) => {
  const completedIds = achievements
    .filter(achievement => {
      // Skip achievements that are already completed or claimed
      if (achievement.completed || achievement.claimed || achievement.status === 'claimed') {
        return false;
      }
      
      // Handle achievement based on its type and status
      if (achievement.id === 'five-star-review') {
        // For review achievements, check if it's already marked as completed in DB
        return achievement.status === 'completed';
      } else if (achievement.checkFn) {
        // For regular achievements with check functions, evaluate the check
        return achievement.checkFn(userData);
      }
      
      // No completion criteria found
      return false;
    })
    .map(achievement => achievement.id);
    
  return completedIds;
};

/**
 * Update achievements with completion status
 * @param {Array} achievements - Current achievements array
 * @param {Array} completedIds - IDs of achievements to mark as completed
 * @returns {Array} Updated achievements array
 */
export const markAchievementsAsCompleted = (achievements, completedIds) => {
  if (!completedIds.length) return achievements;
  
  return achievements.map(achievement => {
    if (completedIds.includes(achievement.id)) {
      return {
        ...achievement,
        completed: true,
        date_completed: new Date().toISOString(),
        newlyCompleted: true
      };
    }
    return achievement;
  });
};

/**
 * Update a single achievement's claim status
 * @param {Array} achievements - Current achievements array 
 * @param {string} achievementId - ID of achievement to mark as claimed
 * @returns {Array} Updated achievements array
 */
export const markAchievementAsClaimed = (achievements, achievementId) => {
  return achievements.map(a => 
    a.id === achievementId 
      ? { 
          ...a, 
          claimed: true, 
          completed: true, // Ensure it's also marked as completed
          status: 'claimed', // Set the status property explicitly
          date_claimed: new Date().toISOString() 
        } 
      : a
  );
};

/**
 * Update achievement with pending verification status
 * @param {Array} achievements - Current achievements array
 * @param {string} achievementId - ID of achievement to mark as pending
 * @returns {Array} Updated achievements array
 */
export const markAchievementAsPending = (achievements, achievementId) => {
  return achievements.map(a => 
    a.id === achievementId 
      ? { ...a, pending: true } 
      : a
  );
};

/**
 * Count claimed achievements
 * @param {Array} achievements - Achievements array
 * @returns {number} Count of claimed achievements
 */
export const countClaimedAchievements = (achievements) => {
  return achievements.filter(achievement => achievement.claimed).length;
}; 