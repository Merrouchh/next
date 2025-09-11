import React from 'react';
import styles from '../../styles/EventDetail.module.css';

// Main event loading skeleton
export const EventLoadingSkeleton = () => {
  return (
    <div className={styles.eventDetailSkeleton}>
      <div className={styles.eventHeaderSkeleton}>
        <div className={styles.eventImageSkeleton}></div>
        <div className={styles.eventInfoSkeleton}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLineShort}></div>
        </div>
      </div>
      <div className={styles.eventContentSkeleton}>
        <div className={styles.skeletonSectionTitle}></div>
        <div className={styles.skeletonParagraph}>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLine}></div>
          <div className={styles.skeletonLineShort}></div>
        </div>
      </div>
    </div>
  );
};

// Registration status loading
export const RegistrationStatusLoading = () => {
  return (
    <div className={styles.registrationStatusLoading}>
      <div className={styles.skeletonButton}></div>
    </div>
  );
};

// Bracket loading state
export const BracketLoading = () => {
  return (
    <div className={styles.bracketLoading}>
      <div className={styles.loadingSpinner}></div>
      <p>Loading tournament bracket...</p>
    </div>
  );
};

// Gallery loading state
export const GalleryLoading = () => {
  return (
    <div className={styles.galleryLoading}>
      <div className={styles.gallerySkeletonGrid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className={styles.galleryImageSkeleton}></div>
        ))}
      </div>
    </div>
  );
};

// Loading button with spinner
export const LoadingButton = ({ children, isLoading, disabled, className, ...props }) => {
  return (
    <button 
      {...props}
      disabled={disabled || isLoading}
      className={`${className} ${isLoading ? styles.loadingButton : ''}`}
    >
      {isLoading ? (
        <>
          <div className={styles.buttonSpinner}></div>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Progress indicator for long operations
export const ProgressIndicator = ({ progress, message, showPercentage = false }) => {
  return (
    <div className={styles.progressIndicator}>
      {message && <p className={styles.progressMessage}>{message}</p>}
      <div className={styles.progressBarOuter}>
        <div 
          className={styles.progressBarInner}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      </div>
      {showPercentage && (
        <span className={styles.progressPercentage}>
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
};

// Enhanced loading overlay with message
export const LoadingOverlay = ({ message, isVisible, children }) => {
  if (!isVisible) return children;
  
  return (
    <div className={styles.loadingOverlay}>
      <div className={styles.loadingContent}>
        <div className={styles.loadingSpinner}></div>
        {message && <p className={styles.loadingMessage}>{message}</p>}
      </div>
      <div className={styles.loadingBackground}>
        {children}
      </div>
    </div>
  );
};

// Smart loading state that adapts based on device performance
export const AdaptiveLoader = ({ isOldDevice, message }) => {
  const loadingMessage = isOldDevice 
    ? `${message} (This may take a moment on older devices...)`
    : message;
  
  return (
    <div className={`${styles.adaptiveLoader} ${isOldDevice ? styles.oldDeviceLoader : ''}`}>
      <div className={styles.loadingSpinner}></div>
      <p className={styles.loadingMessage}>{loadingMessage}</p>
      {isOldDevice && (
        <div className={styles.oldDeviceHint}>
          <small>💡 Consider updating your browser for better performance</small>
        </div>
      )}
    </div>
  );
};

const LoadingStates = {
  EventLoadingSkeleton,
  RegistrationStatusLoading,
  BracketLoading,
  GalleryLoading,
  LoadingButton,
  ProgressIndicator,
  LoadingOverlay,
  AdaptiveLoader
};

export default LoadingStates; 