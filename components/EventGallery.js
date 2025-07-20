import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { 
  FaImage, 
  FaTrashAlt, 
  FaUpload, 
  FaTimes, 
  FaSpinner, 
  FaPlus, 
  FaArrowLeft, 
  FaArrowRight,
  FaExpand,
  FaCheck
} from 'react-icons/fa';
import { createPortal } from 'react-dom';
import styles from '../styles/EventGallery.module.css';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useWindowDimensions';

// Simplified slideshow image component with fallback, wrapped in React.memo
const SlideshowImage = React.memo(({ image, onLoaded, onError }) => {
  const [imageError, setImageError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery image` 
    : `Event gallery image ${image.id}`;
  
  // Handle image load immediately without setTimeout to prevent race conditions
  const handleImageLoad = () => {
    setIsImageLoaded(true);
    // Call onLoaded immediately without setTimeout
    onLoaded();
  };
  
  // Use useEffect to ensure browser knows the image is visible
  useEffect(() => {
    // If image is already in browser cache, it might not trigger onLoad
    // Check if the image is complete already
    const imgElement = document.querySelector(`img[src="${image.image_url}"]`);
    if (imgElement && imgElement.complete && !imageError) {
      handleImageLoad();
    }
  }, [image.image_url, imageError]);
  
  return (
    <>
      {!imageError ? (
          <img 
            src={image.image_url} 
            alt={imageAlt}
            title={imageTitle}
            className={`${styles.slideImage} ${isImageLoaded ? styles.visible : styles.hidden}`}
            decoding="async"
            loading="eager" 
            fetchpriority="high"
            itemProp="contentUrl"
            onLoad={handleImageLoad}
            onError={() => {
              console.log('Slideshow image failed to load:', image.image_url);
              setImageError(true);
              onError();
            }}
            style={{
              transform: 'translateZ(0)', // Force GPU acceleration
              backfaceVisibility: 'hidden', // Prevent flickering
              willChange: 'opacity' // Hint for browser optimization
            }}
          />
      ) : (
        // Fallback to placeholder if image fails
        <div className={styles.imagePlaceholder}>
          <FaImage size={48} />
          <p>Image not available</p>
        </div>
      )}
    </>
  );
});

// Slideshow Modal component - moved outside to be rendered as a portal
const SlideshowModal = React.memo(({ isOpen, onClose, images, currentIndex, onNext, onPrevious }) => {
  const [slideLoaded, setSlideLoaded] = useState(false);
  const isMobile = useIsMobile(767);
  const slideshowRef = useRef(null);
  
  // Reset slide loaded state when current index changes
  useEffect(() => {
    setSlideLoaded(false);
  }, [currentIndex]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        onPrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scrolling when slideshow is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Restore body scrolling when slideshow is closed
      document.body.style.overflow = '';
    };
  }, [isOpen, onNext, onPrevious, onClose]);
  
  const onSlideLoaded = () => {
    console.log("Slide loaded successfully");
    setSlideLoaded(true);
  };
  
  const onSlideError = () => {
    console.log("Slide failed to load, still marking as loaded");
    setSlideLoaded(true);
  };
  
  // Preload adjacent images for smoother navigation
  useEffect(() => {
    if (isOpen && images.length > 1) {
      const nextIdx = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
      const prevIdx = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
      
      // Preload next and previous images
      const preloadNext = new Image();
      preloadNext.src = images[nextIdx].image_url;
      
      const preloadPrev = new Image();
      preloadPrev.src = images[prevIdx].image_url;
    }
  }, [isOpen, images, currentIndex]);
  
  if (!isOpen || !images.length) return null;
  
  // Only render portal on client side
  if (typeof window === 'undefined') return null;
  
  return createPortal(
    <div className={styles.slideshowPortal} ref={slideshowRef}>
      <div className={styles.slideModalOverlay} onClick={onClose}>
        <div className={`${styles.slideModal} ${isMobile ? styles.mobileSlideModal : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className={styles.slideModalHeader}>
            <button 
              className={styles.slideModalCloseButton}
              onClick={onClose}
              aria-label="Close slideshow"
            >
              <FaTimes />
            </button>
          </div>
          
          <div className={styles.slideContent}>
            {/* Show loading spinner until image is loaded */}
            {!slideLoaded && (
              <div className={styles.slideLoading}>
                <FaSpinner className={styles.spinnerIcon} />
              </div>
            )}
            
            {/* Use SlideshowImage component for error handling */}
            <SlideshowImage 
              image={images[currentIndex]}
              onLoaded={onSlideLoaded}
              onError={onSlideError}
            />
            
            {images.length > 1 && (
              <>
                <button 
                  className={`${styles.slideNavButton} ${styles.prevButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrevious();
                  }}
                  aria-label="Previous image"
                >
                  <FaArrowLeft />
                </button>
                
                <button 
                  className={`${styles.slideNavButton} ${styles.nextButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext();
                  }}
                  aria-label="Next image"
                >
                  <FaArrowRight />
                </button>
              </>
            )}
          </div>
          
          {images[currentIndex].caption && (
            <div className={styles.slideCaption}>
              {images[currentIndex].caption}
            </div>
          )}
          
          <div className={styles.slideCounter}>
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

// Placeholder component for when images are loading
const GalleryPlaceholder = React.memo(() => {
  return (
    <div className={styles.galleryItem}>
      <div className={`${styles.imageContainer} ${styles.placeholderContainer}`}>
        <div className={styles.thumbnailLoading}>
          <FaSpinner className={styles.spinnerIcon} />
        </div>
      </div>
      {/* Empty caption space to ensure consistent height */}
      <div className={styles.imageCaption} style={{ opacity: 0 }}>
        No caption
      </div>
    </div>
  );
});

// Optimize GalleryThumbnail with memo
const GalleryThumbnail = React.memo(({ image, onClick, onDelete, isAdmin }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery thumbnail` 
    : `Event gallery thumbnail ${image.id}`;
  
  // Load immediately without timeout
  const handleImageLoad = () => {
    setIsLoading(false);
    setIsVisible(true);
  };

  // Handle image load error
  const handleImageError = () => {
    console.error('Image failed to load:', image.image_url);
    setImageError(true);
    setIsLoading(false);
  };
  
  // Check if image is already loaded in cache
  useEffect(() => {
    const imgElement = document.querySelector(`img[data-thumbnail-id="${image.id}"]`);
    if (imgElement && imgElement.complete && !imageError) {
      handleImageLoad();
    }
  }, [image.id, imageError]);

  return (
    <div 
      className={styles.galleryItem}
      onClick={onClick}
      itemScope
      itemType="http://schema.org/ImageObject"
    >
      <div className={styles.imageContainer}>
        {isLoading && !imageError && (
          <div className={styles.thumbnailLoading}>
            <FaSpinner className={styles.spinnerIcon} />
          </div>
        )}
        
        {!imageError ? (
          <img 
            src={image.image_url}
            alt={imageAlt}
            title={imageTitle}
            className={`${styles.thumbnail} ${isVisible ? styles.visible : styles.hidden}`}
            loading="lazy"
            data-thumbnail-id={image.id}
            itemProp="thumbnailUrl"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              willChange: 'opacity, transform'
            }}
          />
        ) : (
          <div className={styles.thumbnailError}>
            <FaImage size={30} />
            <p>Image Error</p>
          </div>
        )}
        
        {isAdmin && (
          <button
            className={styles.deleteButton}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(image.id);
            }}
            aria-label="Delete image"
          >
            <FaTrashAlt />
          </button>
        )}
        
        <button
          className={styles.expandButton}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          aria-label="View full image"
        >
          <FaExpand />
        </button>
      </div>
      
      {image.caption && (
        <div className={styles.imageCaption} itemProp="name">
          {image.caption}
        </div>
      )}
      
      {/* Hidden metadata for SEO */}
      <meta itemProp="description" content={image.caption || `Event gallery image ${image.id}`} />
      <meta itemProp="contentUrl" content={image.image_url} />
      <meta itemProp="uploadDate" content={image.created_at || new Date().toISOString()} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the image changes
  return prevProps.image.id === nextProps.image.id;
});

// Create a separate component for the upload modal
const UploadModal = React.memo(({ isOpen, onClose, onSubmit, caption, setCaption, imagePreview, selectedImage, setSelectedImage, setImagePreview, fileInputRef, isUploading, compressionInfo }) => {
  // Only render portal on client side
  if (!isOpen || typeof window === 'undefined') return null;
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    const fileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!fileTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    setSelectedImage(file);
  };
  
  return createPortal(
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Add Gallery Image</h3>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className={styles.uploadForm}>
          <div className={styles.fileInputContainer}>
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className={styles.imagePreview} 
                />
                <button 
                  type="button" 
                  className={styles.clearPreviewButton}
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  <FaTimes />
                </button>
              </div>
            ) : (
              <label className={styles.fileInputLabel}>
                <FaUpload className={styles.uploadIcon} />
                <span>Click to select image</span>
                <input 
                  type="file"
                  accept="image/jpeg, image/png, image/gif, image/webp"
                  className={styles.fileInput}
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </label>
            )}
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="caption">Caption (optional)</label>
            <input 
              type="text"
              id="caption"
              placeholder="Add a caption for the image"
              className={styles.captionInput}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          
          {/* Compression info display */}
          {compressionInfo && (
            <div className={`${styles.compressionInfo} ${styles[`compressionInfo${compressionInfo.status || 'default'}`]}`}>
              <div className={styles.compressionIcon}>
                {compressionInfo.status === 'compressing' && <FaSpinner className={styles.spinner} />}
                {compressionInfo.status === 'success' && <FaCheck />}
                {compressionInfo.status === 'error' && <FaTimes />}
                {!compressionInfo.status && <FaImage />}
              </div>
              <div className={styles.compressionDetails}>
                <div className={styles.compressionMessage}>{compressionInfo.message}</div>
                {compressionInfo.originalSize && (
                  <div className={styles.compressionSize}>
                    Original: {compressionInfo.originalSize}KB
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className={styles.modalFooter}>
            <button 
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className={styles.submitButton}
              disabled={!selectedImage || isUploading}
            >
              {isUploading ? (
                <>
                  <FaSpinner className={styles.spinnerIcon} />
                  Uploading...
                </>
              ) : 'Upload Image'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
});

// Main component
const EventGallery = ({ eventId, hideTitle = false }) => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [compressionInfo, setCompressionInfo] = useState(null);
  
  // Slideshow state
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideLoaded, setSlideLoaded] = useState(false);
  
  // For placeholders while images load
  const [imageCount, setImageCount] = useState(0);
  const [hasInitialCount, setHasInitialCount] = useState(false);
  
  const { user, supabase } = useAuth();
  const fileInputRef = useRef(null);
  const hasRendered = useRef(false);

  // Check if user is an admin
  const isAdmin = user?.isAdmin || false;

  // Fetch initial image count to render placeholders
  useEffect(() => {
    if (eventId && !hasRendered.current) {
      // First do a quick count-only fetch to get the number of images
      fetchImageCount();
      
      // Then fetch the full gallery data
      fetchGalleryImages();
      hasRendered.current = true;
    }
    
    // Cleanup any pending image loads when unmounting
    return () => {
      setImages([]);
    };
  }, [eventId]);

  // Fetch just the count of images for placeholders
  const fetchImageCount = async () => {
    try {
      const response = await fetch(`/api/events/gallery/count?eventId=${eventId}`);
      
      if (response.ok) {
        const data = await response.json();
        setImageCount(data.count || 0);
        setHasInitialCount(true);
      }
    } catch (error) {
      console.error('Error fetching image count:', error);
      // On error, we'll just not show placeholders, which is fine
    }
  };

  // Memoize callback functions to prevent re-renders
  const openSlideshow = React.useCallback((index) => {
    setCurrentSlideIndex(index);
    setSlideLoaded(false);
    setSlideshowOpen(true);
    // Add analytics tracking if needed
    try {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'view_gallery_image', {
          event_id: eventId,
          image_index: index
        });
      }
    } catch (e) {
      console.error('Analytics error', e);
    }
  }, [eventId]);
  
  const closeSlideshow = React.useCallback(() => {
    setSlideshowOpen(false);
  }, []);

  const showNextSlide = React.useCallback(() => {
    setSlideLoaded(false);
    setCurrentSlideIndex((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  }, [images.length]);
  
  const showPreviousSlide = React.useCallback(() => {
    setSlideLoaded(false);
    setCurrentSlideIndex((prev) => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  }, [images.length]);

  // Handle keyboard navigation for slideshow with a stable callback
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!slideshowOpen) return;
      
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        showPreviousSlide();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        showNextSlide();
      } else if (e.key === 'Escape') {
        closeSlideshow();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [slideshowOpen, showPreviousSlide, showNextSlide, closeSlideshow]);

  const fetchGalleryImages = async () => {
    setIsLoading(true);
    try {
      // Simple fetch with a 15-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Add a cache-busting parameter for the API request
      const response = await fetch(`/api/events/gallery?eventId=${eventId}&_t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Failed to fetch gallery images');
      }
      
      const data = await response.json();
      const galleryImages = data.images || [];
      
      setImages(galleryImages);
      setImageCount(galleryImages.length);
      setHasInitialCount(true);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Gallery fetch timed out, continuing silently');
      } else {
        console.error('Error fetching gallery:', error);
        toast.error('Could not load all gallery images');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection - memoized
  const handleFileChange = React.useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Clear previous compression info
    setCompressionInfo(null);
    
    // Check file type
    const fileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!fileTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, GIF, WEBP)');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB');
      return;
    }
    
    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    setSelectedImage(file);
    
    // Show compression info
    const originalSizeKB = (file.size / 1024).toFixed(1);
    setCompressionInfo({
      originalSize: originalSizeKB,
      message: `Image will be automatically compressed for optimal social media sharing (target: <270KB)`
    });
  }, []);

  // Upload image - memoized
  const uploadImage = React.useCallback(async (e) => {
    e.preventDefault();
    
    if (!selectedImage) {
      toast.error('Please select an image to upload');
      return;
    }
    
    setIsUploading(true);
    setCompressionInfo(prev => prev ? { ...prev, status: 'compressing' } : null);
    const loadingToast = toast.loading('Uploading and compressing image...');
    
    try {
      // Get auth token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication required - could not retrieve session');
      }
      
      if (!sessionData || !sessionData.session) {
        console.error('No session found');
        throw new Error('Authentication required - no session found');
      }
      
      const accessToken = sessionData.session.access_token;
      
      if (!accessToken) {
        console.error('No access token in session');
        throw new Error('Authentication required - no access token');
      }
      
      console.log('Access token retrieved, length:', accessToken.length);
      
      // Create form data
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('eventId', eventId);
      formData.append('caption', caption);
      
      // Upload image
      console.log('Sending POST request to /api/events/gallery');
      const response = await fetch('/api/events/gallery', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData,
        credentials: 'include' // Important to include cookies
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Failed to upload image';
        try {
        const error = await response.json();
          errorMessage = error.error || errorMessage;
          console.error('Upload error response:', error);
        } catch (e) {
          console.error('Could not parse error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      toast.dismiss(loadingToast);
      
      // Add new image to the gallery
      setImages(prevImages => [data.image, ...prevImages]);
      setImageCount(prevCount => prevCount + 1);
      
      // Update compression info with success
      setCompressionInfo(prev => prev ? { 
        ...prev, 
        status: 'success',
        message: 'Image compressed and uploaded successfully! Optimized for social media sharing.'
      } : null);
      
      // Reset form
      setSelectedImage(null);
      setImagePreview(null);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Close modal
      setIsModalOpen(false);
      
      toast.success('Image uploaded and optimized successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to upload image');
      
      // Update compression info with error
      setCompressionInfo(prev => prev ? { 
        ...prev, 
        status: 'error',
        message: 'Image upload failed. Please try again.'
      } : null);
    } finally {
      setIsUploading(false);
    }
  }, [eventId, selectedImage, caption, supabase, setIsModalOpen]);

  // Memoize the delete function to maintain a stable reference
  const deleteImage = React.useCallback(async (e, imageId) => {
    e.stopPropagation(); // Prevent opening slideshow when clicking delete
    
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }
    
    const loadingToast = toast.loading('Deleting image...');
    
    try {
      // Get auth token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error when deleting:', sessionError);
        throw new Error('Authentication required - could not retrieve session');
      }
      
      if (!sessionData || !sessionData.session) {
        console.error('No session found when deleting');
        throw new Error('Authentication required - no session found');
      }
      
      const accessToken = sessionData.session.access_token;
      
      if (!accessToken) {
        console.error('No access token in session when deleting');
        throw new Error('Authentication required - no access token');
      }
      
      console.log('Access token for delete retrieved, length:', accessToken.length);
      
      console.log('Sending DELETE request for image:', imageId);
      const response = await fetch(`/api/events/gallery?imageId=${imageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include' // Important to include cookies
      });
      
      console.log('Delete response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete image';
        try {
        const error = await response.json();
          errorMessage = error.error || errorMessage;
          console.error('Delete error response:', error);
        } catch (e) {
          console.error('Could not parse delete error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      toast.dismiss(loadingToast);
      
      // Remove deleted image from the state
      setImages(prevImages => prevImages.filter(image => image.id !== imageId));
      setImageCount(prevCount => Math.max(0, prevCount - 1));
      
      // If currently in slideshow mode and the deleted image is displayed, close slideshow
      if (slideshowOpen && images[currentSlideIndex]?.id === imageId) {
        closeSlideshow();
      }
      
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to delete image');
    }
  }, [eventId, images, currentSlideIndex, slideshowOpen, closeSlideshow, supabase]);

  // Open upload modal
  const openModal = React.useCallback(() => {
    setSelectedImage(null);
    setImagePreview(null);
    setCaption('');
    setIsModalOpen(true);
  }, []);

  // Close upload modal
  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    setSelectedImage(null);
    setImagePreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Instead of re-rendering on every slide change, keep a stable reference
  const onSlideLoaded = () => setSlideLoaded(true);
  const onSlideError = () => setSlideLoaded(true);

  // Render placeholders while loading
  const renderPlaceholders = () => {
    // Always allow placeholder rendering (empty gallery message shows later)
    
    const placeholders = [];
    for (let i = 0; i < imageCount; i++) {
      placeholders.push(<GalleryPlaceholder key={`placeholder-${i}`} />);
    }
    return placeholders;
  };

  return (
    <div 
      className={`${styles.galleryContainer} ${hideTitle ? styles.noTitleSpacing : ''}`} 
      itemScope
      itemType="http://schema.org/ImageGallery"
    >
      <meta itemProp="about" content={`Event ${eventId}`} />
      <meta itemProp="creator" content="Merrouch Gaming Center" />
      <meta itemProp="datePublished" content={new Date().toISOString().split('T')[0]} />
      
      {!hideTitle && (
        <div className={styles.galleryHeader}>
          <h2 className={styles.galleryTitle}>
            <FaImage className={styles.galleryIcon} /> Event Gallery
          </h2>
        </div>
      )}
      
      {/* Hide section completely if not loaded yet */}
      {!hasInitialCount ? null : (
        <>
          {!hideTitle && <hr className={styles.galleryHorizontalRule} />}            
          {/* Admin controls - only shown to admins */}
          {isAdmin && (
            <div className={styles.adminControls}>
              <button 
                className={styles.addImageButton}
                onClick={openModal}
                disabled={isUploading}
              >
                <FaPlus /> Add Image
              </button>
            </div>
          )}
          
          {/* Loading state for gallery */}
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <FaSpinner className={styles.spinnerIcon} />
              <p>Loading gallery...</p>
            </div>
          ) : images.length === 0 ? (
            <div className={styles.emptyGallery}>
              {hasInitialCount ? (
                <>
                  <FaImage size={32} />
                  <p>No images have been added to this event gallery yet.</p>
                </>
              ) : (
                <p>Loading gallery...</p>
              )}
            </div>
          ) : (
            <div 
              className={styles.galleryGrid}
              role="list"
              aria-label="Event gallery images"
            >
              {isLoading && hasInitialCount ? (
                renderPlaceholders()
              ) : (
                images.map((image, index) => (
                  <GalleryThumbnail
                    key={image.id}
                    image={image}
                    onClick={() => openSlideshow(index)}
                    onDelete={deleteImage}
                    isAdmin={isAdmin}
                  />
                ))
              )}
            </div>
          )}
          
          {/* Upload Modal */}
          <UploadModal
            isOpen={isModalOpen}
            onClose={closeModal}
            onSubmit={uploadImage}
            caption={caption}
            setCaption={setCaption}
            imagePreview={imagePreview}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            setImagePreview={setImagePreview}
            fileInputRef={fileInputRef}
            isUploading={isUploading}
            compressionInfo={compressionInfo}
          />
          
          {/* Slideshow Modal */}
          <SlideshowModal 
            isOpen={slideshowOpen}
            onClose={closeSlideshow}
            images={images}
            currentIndex={currentSlideIndex}
            onNext={showNextSlide}
            onPrevious={showPreviousSlide}
          />
        </>
      )}
    </div>
  );
};

export default React.memo(EventGallery);