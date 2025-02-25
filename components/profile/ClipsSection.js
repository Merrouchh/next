import React, { useEffect, useState } from 'react';
import { useProfileClips } from '../../hooks/useProfileClips';
import ClipCard from '../../components/ClipCard';
import styles from '../../styles/Profile.module.css';

// For handling clips display and infinite scroll
const ClipsSection = ({ username, initialClips, isOwner }) => {
  const { clips, loading, hasMore, loadMore } = useProfileClips(username, initialClips);
  
  return (
    <div className={styles.clipsSection}>
      <div className={styles.clipsGrid}>
        {clips.map(clip => (
          <div key={clip.id} className={styles.clipWrapper}>
            <ClipCard 
              clip={clip}
              isOwner={isOwner}
              onClipUpdate={(clipId, action) => {
                if (action === 'delete') {
                  // Handle clip deletion
                }
              }}
            />
          </div>
        ))}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipsSection; 