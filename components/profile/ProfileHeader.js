import React, { useState, useEffect } from 'react';
import { AiOutlineUser, AiOutlineCamera } from 'react-icons/ai';
import styles from '../../styles/Profile.module.css';
import { fetchUserPicture, cleanupBlobUrls, uploadUserPicture } from '../../utils/api';

// For user's basic info, avatar, and stats
const ProfileHeader = ({ username, gizmo_id, totalClips, isOwner }) => {
  const [pictureUrl, setPictureUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProfilePicture = async () => {
      if (!gizmo_id) {
        setLoading(false);
        return;
      }

      try {
        const url = await fetchUserPicture(gizmo_id);
        if (mounted) {
          setPictureUrl(url);
        }
      } catch (error) {
        // Ignore error - will show placeholder
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfilePicture();

    return () => {
      mounted = false;
      cleanupBlobUrls();
    };
  }, [gizmo_id]);

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setLoading(true);
      const success = await uploadUserPicture(gizmo_id, file);

      if (success) {
        const newPicture = await fetchUserPicture(gizmo_id);
        setPictureUrl(newPicture);
      } else {
        throw new Error('Failed to upload picture');
      }
    } catch (error) {
      console.error('Error uploading picture:', error);
      alert('Failed to upload picture. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProfileImage = () => {
    return (
      <div className={styles.profileImageContainer}>
        {loading ? (
          <div className={styles.profileImageLoading}>
            <div className={styles.spinner} />
          </div>
        ) : pictureUrl ? (
          <img 
            src={pictureUrl}
            alt={`${username}'s profile`}
            className={styles.profileImage}
            onError={() => {
              setPictureUrl(null);
              setError(true);
            }}
          />
        ) : (
          <div className={styles.profileImagePlaceholder}>
            <AiOutlineUser className={styles.placeholderIcon} />
          </div>
        )}
        
        {isOwner && !loading && (
          <label className={styles.uploadButtonOverlay}>
            <input
              type="file"
              accept="image/*"
              onChange={handlePictureUpload}
              className={styles.hiddenInput}
            />
            <AiOutlineCamera className={styles.uploadIcon} />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className={styles.profileHeader}>
      <div className={styles.profileTop}>
        <div className={styles.profileInfo}>
          {renderProfileImage()}
          <div className={styles.profileDetails}>
            <h1>{username}'s Profile</h1>
            <div className={styles.profileStats}>
              <div className={styles.statItem}>
                {totalClips > 0 ? (
                  <>
                    <span>{totalClips}</span>
                    <label>Clips</label>
                  </>
                ) : (
                  <span className={styles.noClips}>No clips shared yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader; 