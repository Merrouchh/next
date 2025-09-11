import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { AiOutlineUser, AiOutlineCamera } from 'react-icons/ai';
import { fetchUserPicture, uploadUserPicture } from '../../utils/api';

// Helper function for image to base64 if it's not exported from utils/api - UNUSED
/*
const imageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};
*/

const ProfilePicture = ({ 
  userId, 
  username, 
  isOwner = false, 
  size = 150, 
  showUploadButton = true 
}) => {
  const [pictureUrl, setPictureUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const loadProfilePicture = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Clear any existing timeout
        if (requestTimeoutRef.current) {
          clearTimeout(requestTimeoutRef.current);
        }
        
        // Set a timeout to abort the request after 8 seconds
        const timeoutPromise = new Promise((_, reject) => {
          requestTimeoutRef.current = setTimeout(() => {
            reject(new Error('Picture loading timeout'));
          }, 8000);
        });
        
        // Try to load the user picture
        const fetchPromise = fetchUserPicture(userId).catch(err => {
          console.error('Error in fetchUserPicture:', err);
          return null;
        });
        
        // Race between fetch and timeout
        const url = await Promise.race([fetchPromise, timeoutPromise]);
        
        // Clear the timeout since the request completed
        if (requestTimeoutRef.current) {
          clearTimeout(requestTimeoutRef.current);
          requestTimeoutRef.current = null;
        }
        
        if (mountedRef.current) {
          setPictureUrl(url);
          setError(false);
        }
      } catch (error) {
        console.warn('Profile picture load failed:', error.message);
        if (mountedRef.current) {
          setError(true);
          setPictureUrl(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadProfilePicture();
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
    };
  }, [userId]);

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setLoading(true);
      setError(false);
      const success = await uploadUserPicture(userId, file);

      if (success) {
        try {
          // Clear any existing timeout
          if (requestTimeoutRef.current) {
            clearTimeout(requestTimeoutRef.current);
          }
          
          // Set a timeout for the refresh request
          const timeoutPromise = new Promise((_, reject) => {
            requestTimeoutRef.current = setTimeout(() => {
              reject(new Error('Picture refresh timeout'));
            }, 8000);
          });
          
          // Try to get the updated picture
          const fetchPromise = fetchUserPicture(userId).catch(err => {
            console.error('Error fetching updated picture:', err);
            return null;
          });
          
          // Race the promises
          const newPictureUrl = await Promise.race([fetchPromise, timeoutPromise]);
          
          // Clear the timeout
          if (requestTimeoutRef.current) {
            clearTimeout(requestTimeoutRef.current);
            requestTimeoutRef.current = null;
          }
          
          if (mountedRef.current) {
            setPictureUrl(newPictureUrl);
          }
        } catch (error) {
          console.warn('Picture refresh failed:', error.message);
          // If refresh fails, we still want to try to show the picture
          if (mountedRef.current) {
            // Just try once more to get the picture
            try {
              const url = await fetchUserPicture(userId);
              if (mountedRef.current) {
                setPictureUrl(url);
              }
            } catch (finalError) {
              console.error('Final attempt to get picture failed:', finalError);
            }
          }
        }
      } else {
        setError(true);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(true);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div 
      className="profilePictureContainer"
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        maxWidth: '100%'
      }}
    >
      {loading ? (
        <div className="loadingContainer">
          <div className="loadingSpinner" />
        </div>
      ) : error ? (
        <div className="fallbackAvatar">
          <AiOutlineUser size={size * 0.45} />
        </div>
      ) : pictureUrl ? (
        <Image 
          src={pictureUrl} 
          alt={`${username || 'User'}'s profile`}
          className="profileImage"
          width={size}
          height={size}
          onError={() => setError(true)}
        />
      ) : (
        <div className="fallbackAvatar">
          <AiOutlineUser size={size * 0.45} />
        </div>
      )}
      
      {isOwner && showUploadButton && !loading && (
        <label className="uploadOverlay">
          <input
            type="file"
            accept="image/*"
            onChange={handlePictureUpload}
            className="hiddenInput"
          />
          <AiOutlineCamera className="cameraIcon" size={Math.max(22, size * 0.18)} />
        </label>
      )}

      <style jsx>{`
        .profilePictureContainer {
          position: relative;
          border-radius: 50%;
          overflow: hidden;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .loadingContainer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loadingSpinner {
          width: ${Math.max(24, size * 0.2)}px;
          height: ${Math.max(24, size * 0.2)}px;
          border-radius: 50%;
          border: 3px solid rgba(138, 43, 226, 0.15);
          border-top: 3px solid #8A2BE2;
          animation: spin 1s linear infinite;
        }

        .profileImage {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }

        .fallbackAvatar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FFD700;
        }

        .uploadOverlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.4);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .hiddenInput {
          display: none;
        }

        .uploadOverlay:hover {
          opacity: 1;
        }

        .cameraIcon {
          color: #FFD700;
          filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.5));
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Mobile styles */
        @media (max-width: 768px) {
          .uploadOverlay {
            opacity: 0.7;
            background: rgba(0, 0, 0, 0.25);
          }
        }
      `}</style>
    </div>
  );
};

export default ProfilePicture; 