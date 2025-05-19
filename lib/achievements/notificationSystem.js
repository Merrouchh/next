import toast from 'react-hot-toast';

/**
 * Initialize the notification system
 * No longer needed for in-memory tracking, but kept for backward compatibility
 */
export const initNotificationSystem = () => {
  // This function now only exists for backwards compatibility
  // Achievement notification tracking is done via database
};

/**
 * Show achievement notifications with appropriate styling and timing
 * @param {Array} achievements - Array of achievement objects to show notifications for
 */
export const showAchievementNotifications = (achievements) => {
  if (!achievements || achievements.length === 0) {
    return;
  }
  
  // Show notifications with delay between them
  achievements.forEach((achievement, index) => {
    setTimeout(() => {
      // For all achievements, use the same notification style
      const message = `Achievement unlocked: ${achievement.name}!`;
      
      toast.success(message, {
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #9D4EDD',
        },
        iconTheme: {
          primary: '#9D4EDD',
          secondary: '#333',
        },
        duration: 5000
      });
    }, index * 1500); // 1.5 second between notifications
  });
};

/**
 * Show a success notification when an achievement is claimed
 * @param {string} name - Achievement name
 * @param {number} points - Points awarded
 */
export const notifyAchievementClaimed = (name, points) => {
  toast.success(`Achievement claimed! +${points} points`, {
    style: {
      background: '#333',
      color: '#fff',
      border: '1px solid #FFD700',
    },
    iconTheme: {
      primary: '#FFD700',
      secondary: '#333',
    },
    duration: 4000
  });
}; 