import React, { useCallback } from 'react';
import Image from 'next/image';
import { FaCalendarAlt } from 'react-icons/fa';
import styles from '../../styles/Events.module.css';
import { formatTime } from '../../utils/eventDetailHelpers';

// iOS detection utility - moved to shared utils
const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Safe navigation utility
const safeNavigate = async (router, path) => {
  try {
    await router.push(path);
  } catch {
    window.location.href = path;
  }
};

// Text utilities
const truncateText = (text, maxLength = 200) => {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return text.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};

const truncateTitle = (title, maxWords = 6) => {
  if (!title) return '';
  
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  
  return words.slice(0, maxWords).join(' ') + '...';
};

// Event Card Badge Component
export const EventCardBadges = React.memo(function EventCardBadges({ event, isRegistered, registeredCount }) {
  const getBadgeContainerClass = () => {
    const isFull = 
      event.registration_limit !== null && 
      registeredCount >= event.registration_limit;
    
    if (event.status === 'Completed') {
      return styles.completedBadges;
    } else if (event.status === 'In Progress') {
      return styles.progressBadges;
    } else if (isFull) {
      return styles.fullBadges;
    } else {
      return styles.normalBadges;
    }
  };

  return (
    <div className={`${styles.badgeContainer} ${getBadgeContainerClass()}`}>
      {/* Status badge - always present */}
      <div className={`${styles.eventStatusBadge} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
        {event.status || 'Upcoming'}
      </div>
      
      {/* Event mode badge - if available */}
      {event.team_type && (
        <div className={`${styles.eventModeBadge} ${styles[`mode${event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}`]}`}>
          {event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}
        </div>
      )}
      
      {/* Registered badge - if registered and upcoming */}
      {isRegistered && event.status === 'Upcoming' && (
        <div className={styles.registeredBadge}>
          <span className={styles.checkmark}>✓</span> Registered
        </div>
      )}
    </div>
  );
});

// Event Card Image Component
export const EventCardImage = React.memo(function EventCardImage({ event, isRegistered, registeredCount }) {
  // Badge container class logic
  const getBadgeContainerClass = () => {
    const isFull = 
      event.registration_limit !== null && 
      registeredCount >= event.registration_limit;
    
    if (event.status === 'Completed') {
      return styles.completedBadges;
    } else if (event.status === 'In Progress') {
      return styles.progressBadges;
    } else if (isFull) {
      return styles.fullBadges;
    } else {
      return styles.normalBadges;
    }
  };

  return (
    <div className={styles.eventImageContainer}>
      {event.image ? (
        <Image 
          src={event.image} 
          alt={event.title} 
          className={styles.eventImage}
          width={400}
          height={200}
          unoptimized
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
            e.target.parentNode.classList.add(styles.fallbackImage);
          }}
        />
      ) : (
        <div className={styles.eventImagePlaceholder}>
          <div className={styles.placeholderText}>{event.title.charAt(0).toUpperCase()}</div>
        </div>
      )}
      
      {/* Status badges - positioned over the image */}
      <div className={`${styles.badgeContainer} ${getBadgeContainerClass()}`}>
        {/* Status badge - always present */}
        <div className={`${styles.eventStatusBadge} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
          {event.status || 'Upcoming'}
        </div>
        
        {/* Event mode badge - if available */}
        {event.team_type && (
          <div className={`${styles.eventModeBadge} ${styles[`mode${event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}`]}`}>
            {event.team_type.charAt(0).toUpperCase() + event.team_type.slice(1)}
          </div>
        )}
        
        {/* Registered badge - if registered and upcoming */}
        {isRegistered && event.status === 'Upcoming' && (
          <div className={styles.registeredBadge}>
            <span className={styles.checkmark}>✓</span> Registered
          </div>
        )}
      </div>
      
      {/* Date badge */}
      {event.date && (
        <div className={styles.dateBadge}>
          <div className={styles.dateMonth}>
            {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
          </div>
          <div className={styles.dateDay}>
            {new Date(event.date).toLocaleDateString('en-US', { day: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  );
});

// Event Card Meta Information Component
export const EventCardMeta = React.memo(function EventCardMeta({ event, registeredCount }) {
  // For completed events, always show as full (UI "cheat" to display properly)
  const displayCount = event.status === 'Completed' && event.registration_limit !== null
    ? event.registration_limit
    : registeredCount;
  
  return (
    <div className={styles.eventMeta}>
      <div className={styles.eventTime}>
        <FaCalendarAlt className={styles.metaIcon} /> {formatTime(event.time)}
      </div>
      <div className={styles.eventLocation}>
        <span className={styles.metaIcon}>📍</span> {event.location}
      </div>
      {event.registration_limit && (
        <div className={styles.eventRegistrations}>
          <span className={styles.metaIcon}>👥</span> 
          <div className={styles.registrationProgress}>
            <div className={styles.progressBarContainer}>
              <div 
                className={styles.progressBar}
                style={{ 
                  width: `${Math.min(100, (displayCount / event.registration_limit) * 100)}%`,
                  backgroundColor: displayCount >= event.registration_limit ? '#dc3545' : '#28a745'
                }}
              ></div>
            </div>
            <span className={styles.registrationCount}>
              {displayCount}/{event.registration_limit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

// Event Card Content Component
export const EventCardContent = React.memo(function EventCardContent({ event }) {
  return (
    <div className={`${styles.eventContent} ${styles.forceRepaint}`}>
      <h3 className={styles.eventTitle} title={event.title}>
        {truncateTitle(event.title)}
      </h3>
      {event.game && (
        <div className={styles.eventGameLabelContainer}>
          <span className={styles.eventGameLabel}>{event.game}</span>
        </div>
      )}
      
      <div className={styles.eventDescription}>
        <div className={styles.descriptionText}>
          {truncateText(event.description?.replace(/[#*_`\[\]()~>]/g, '') || '')}
        </div>
      </div>
    </div>
  );
});

// Registration Button Component
export const RegistrationButton = React.memo(function RegistrationButton({ 
  event, 
  isRegistered, 
  checkingRegistration, 
  registeredCount, 
  isPublicView, 
  onClick,
  isLoading 
}) {
  // Get registration button text - memoized to prevent excessive re-calculations
  const getRegistrationButtonText = useCallback(() => {
    // For completed events, always show "View Results"
    if (event.status === 'Completed') {
      return 'View Results';
    }
    
    // For in-progress events, always show "In Progress"
    if (event.status === 'In Progress') {
      return 'View Tournament';
    }
    
    // For public users on upcoming events
    if (isPublicView) {
      return event.status === 'Upcoming' ? 'Login to Register' : 'View Event';
    }
    
    // If user is registered, always show that state (even while checking)
    if (!isPublicView && isRegistered) {
      return 'Registered ✓';
    }
    
    // Show checking state while verifying registration for authenticated users
    if (!isPublicView && checkingRegistration) {
      return 'Loading...';
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return 'Registration Full';
    }
    
    // For authenticated users who are not registered
    return 'Register Now';
  }, [event.status, event.registration_limit, isPublicView, checkingRegistration, registeredCount, isRegistered]);
  
  // Get registration button class - memoized to prevent excessive re-calculations
  const getRegistrationButtonClass = useCallback(() => {
    const baseClass = styles.registerButton;
    
    // For completed events
    if (event.status === 'Completed') {
      return `${baseClass} ${styles.completedButton}`;
    }
    
    // For in-progress events
    if (event.status === 'In Progress') {
      return `${baseClass} ${styles.inProgressButton}`;
    }
    
    // For authenticated users who are registered (takes priority over checking state)
    if (!isPublicView && isRegistered) {
      return `${baseClass} ${styles.registeredButton} ${styles.nonClickable}`;
    }
    
    // Only show loading state if user is logged in and we're checking registration
    if (!isPublicView && checkingRegistration) {
      return `${baseClass} ${styles.loadingButton}`;
    }
    
    // Check if registration is full
    if (event.registration_limit !== null && 
        registeredCount >= event.registration_limit &&
        !isRegistered) {
      return `${baseClass} ${styles.fullButton}`;
    }
    
    // Default case
    return baseClass;
  }, [event.status, event.registration_limit, isPublicView, checkingRegistration, registeredCount, isRegistered]);

  // Check if registration is full
  const isFull = event.registration_limit !== null && 
                 registeredCount >= event.registration_limit &&
                 !isRegistered;

  return (
    <button 
      className={getRegistrationButtonClass()}
      onClick={onClick}
      disabled={
        (!isPublicView && checkingRegistration) ||
        (!isPublicView && isRegistered) ||
        isLoading ||
        isFull
      }
      style={isRegistered || isFull ? { cursor: 'default', opacity: 0.9 } : {}}
    >
      {getRegistrationButtonText()}
    </button>
  );
});

// Loading Spinner Component
export const LoadingSpinner = React.memo(function LoadingSpinner() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}>
        <div className={styles.spinnerInner}></div>
      </div>
      <p className={styles.loadingText}>Loading events...</p>
    </div>
  );
});

// Empty State Component
export const EmptyEventsState = React.memo(function EmptyEventsState({ searchQuery, filter, onClearSearch, onResetFilter }) {
  return (
    <div className={styles.emptyContainer}>
      <div className={styles.emptyIcon}>🎮</div>
      <h2>No Events Found</h2>
      {searchQuery ? (
        <p>No events matching your search: &quot;{searchQuery}&quot;</p>
      ) : (
        <p>There are no events matching your current filter.</p>
      )}
      <div className={styles.emptyActions}>
        {searchQuery && (
          <button 
            className={styles.resetButton}
            onClick={onClearSearch}
          >
            Clear Search
          </button>
        )}
        {filter && filter !== 'all' && (
          <button 
            className={styles.resetButton}
            onClick={onResetFilter}
          >
            Reset Filter
          </button>
        )}
        <button 
          className={styles.primaryButton}
          onClick={() => window.location.href = '/events'}
        >
          View All Events
        </button>
      </div>
    </div>
  );
});

// Export utilities for use in the main component
export { isIOS, safeNavigate, truncateText, truncateTitle }; 