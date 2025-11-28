import React, { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
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
  FaCheck,
  FaEdit
} from 'react-icons/fa';
import { createPortal } from 'react-dom';
import styles from '../styles/EventGallery.module.css';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useWindowDimensions';

// Simplified slideshow image component with fallback, wrapped in React.memo
const SlideshowImage = React.memo(function SlideshowImage({ image, onLoaded, onError }) {
  const [imageError, setImageError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery image` 
    : `Event gallery image ${image.id}`;
  
  // Handle image load immediately without setTimeout to prevent race conditions
  const handleImageLoad = useCallback(() => {
    setIsImageLoaded(true);
    // Call onLoaded immediately without setTimeout
    onLoaded();
  }, [onLoaded]);
  
  // Use useEffect to ensure browser knows the image is visible
  useEffect(() => {
    // If image is already in browser cache, it might not trigger onLoad
    // Check if the image is complete already
    const imgElement = document.querySelector(`img[src="${image.image_url}"]`);
    if (imgElement && imgElement.complete && !imageError) {
      handleImageLoad();
    }
  }, [image.image_url, imageError, handleImageLoad]);
  
  return (
    <>
      {!imageError ? (
          <NextImage 
            src={image.image_url} 
            alt={imageAlt}
            title={imageTitle}
            className={`${styles.slideImage} ${isImageLoaded ? styles.visible : styles.hidden}`}
            itemProp="contentUrl"
            onLoad={handleImageLoad}
            onError={() => {
              console.log('Slideshow image failed to load:', image.image_url);
              setImageError(true);
              onError();
            }}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            style={{ 
              objectFit: 'contain',
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
const SlideshowModal = React.memo(function SlideshowModal({ isOpen, onClose, images, currentIndex, onNext, onPrevious }) {
  // const [slideLoaded, setSlideLoaded] = useState(false); // Removed unused state
  const isMobile = useIsMobile(767);
  const slideshowRef = useRef(null);
  
  // Reset slide loaded state when current index changes - REMOVED
  // useEffect(() => {
  //   setSlideLoaded(false);
  // }, [currentIndex]);
  
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
  };
  
  const onSlideError = () => {
    console.log("Slide failed to load, still marking as loaded");
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
  
  // Handle conditional rendering based on state
  if (!isOpen || !images.length) return null;
  
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
const GalleryPlaceholder = React.memo(function GalleryPlaceholder() {
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
const GalleryThumbnail = React.memo(function GalleryThumbnail({ image, onClick, onDelete, onEdit, isAdmin, isEditing, editCaption, onEditCaptionChange, onSaveEdit, onCancelEdit, isUpdatingCaption }) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = React.useRef(null);
  
  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
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
      className={`${styles.galleryItem} ${isEditing ? styles.editingItem : ''}`}
      onClick={isEditing ? (e) => {
        // Only allow clicks on the edit container, block everything else
        if (!e.target.closest(`.${styles.editCaptionContainer}`)) {
          e.preventDefault();
          e.stopPropagation();
        }
      } : onClick}
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
          <NextImage 
            src={image.image_url}
            alt={imageAlt}
            title={imageTitle}
            className={`${styles.thumbnail} ${isVisible ? styles.visible : styles.hidden}`}
            data-thumbnail-id={image.id}
            itemProp="thumbnailUrl"
            onLoad={handleImageLoad}
            onError={handleImageError}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
            style={{
              objectFit: 'cover',
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
          <>
            <button
              className={styles.editButton}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(image);
              }}
              aria-label="Edit caption"
              title="Edit caption"
            >
              <FaEdit />
            </button>
            <button
              className={styles.deleteButton}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e, image.id);
              }}
              aria-label="Delete image"
              title="Delete image"
            >
              <FaTrashAlt />
            </button>
          </>
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
      
      {isEditing ? (
        <div 
          className={styles.editCaptionContainer}
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="text"
            value={editCaption || ''}
            onChange={(e) => {
              e.stopPropagation();
              const newValue = e.target.value;
              onEditCaptionChange(newValue);
            }}
            className={styles.editCaptionInput}
            placeholder="Enter caption..."
            autoFocus
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
            }}
            onFocus={(e) => {
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              // Only stop propagation for Enter and Escape to prevent opening slideshow
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveEdit(image.id, editCaption);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancelEdit();
                }
              }
              // Allow normal typing - don't stop propagation for other keys
            }}
            onCompositionStart={(e) => {
              e.stopPropagation();
            }}
            onCompositionEnd={(e) => {
              e.stopPropagation();
            }}
            disabled={isUpdatingCaption}
          />
          <div className={styles.editCaptionActions}>
            <button
              className={styles.saveButton}
              onClick={(e) => {
                e.stopPropagation();
                onSaveEdit(image.id, editCaption);
              }}
              disabled={isUpdatingCaption}
              title="Save (Enter)"
            >
              <FaCheck />
            </button>
            <button
              className={styles.cancelButton}
              onClick={(e) => {
                e.stopPropagation();
                onCancelEdit();
              }}
              disabled={isUpdatingCaption}
              title="Cancel (Esc)"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      ) : (
        image.caption && (
          <div className={styles.imageCaption} itemProp="name">
            {image.caption}
          </div>
        )
      )}
      
      {/* Hidden metadata for SEO */}
      <meta itemProp="description" content={image.caption || `Event gallery image ${image.id}`} />
      <meta itemProp="contentUrl" content={image.image_url} />
      <meta itemProp="uploadDate" content={image.created_at || new Date().toISOString()} />
    </div>
  );
}, (prevProps, nextProps) => {
  // Re-render if the image changes OR if isAdmin changes OR if editing state changes OR if editCaption changes
  return prevProps.image.id === nextProps.image.id && 
         prevProps.isAdmin === nextProps.isAdmin &&
         prevProps.isEditing === nextProps.isEditing &&
         prevProps.editCaption === nextProps.editCaption &&
         prevProps.image.caption === nextProps.image.caption &&
         prevProps.isUpdatingCaption === nextProps.isUpdatingCaption;
});

// Create a separate component for the upload modal
const UploadModal = React.memo(function UploadModal({ isOpen, onClose, onSubmit, caption, setCaption, imagePreview, selectedImage, setSelectedImage, setImagePreview, fileInputRef, isUploading, compressionInfo }) {
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
                <NextImage 
                  src={imagePreview} 
                  alt="Preview" 
                  className={styles.imagePreview}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: 'contain' }}
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
  
  // Edit caption state
  const [editingImageId, setEditingImageId] = useState(null);
  const [editCaption, setEditCaption] = useState('');
  const [isUpdatingCaption, setIsUpdatingCaption] = useState(false);
  
  // Slideshow state
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  // const [slideLoaded, setSlideLoaded] = useState(false); // Removed unused state
  
  // For placeholders while images load
  const [imageCount, setImageCount] = useState(0);
  const [hasInitialCount, setHasInitialCount] = useState(false);
  
  const { user, supabase, session } = useAuth();
  const fileInputRef = useRef(null);
  const hasRendered = useRef(false);

  // Check if user is an admin - this will update when user changes
  // Explicitly check for true to ensure it updates when user logs out
  const isAdmin = user !== null && user !== undefined && user.isAdmin === true;

  // Fetch gallery images
  const fetchGalleryImages = useCallback(async () => {
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
  }, [eventId]);

  // Fetch just the count of images for placeholders
  const fetchImageCount = useCallback(async () => {
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
  }, [eventId]);

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
  }, [eventId, fetchGalleryImages, fetchImageCount]);


  // Memoize callback functions to prevent re-renders
  const openSlideshow = React.useCallback((index) => {
    setCurrentSlideIndex(index);
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
    setCurrentSlideIndex((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  }, [images.length]);
  
  const showPreviousSlide = React.useCallback(() => {
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


  // Handle file selection - memoized - UNUSED
  /*
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
  */

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
      // Wait for session to be available - retry up to 3 times with shorter intervals
      let accessToken = session?.access_token;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!accessToken && retryCount < maxRetries) {
        console.log(`[EventGallery] Waiting for session... attempt ${retryCount + 1}/${maxRetries}`);
        
        // Wait a bit and try to get the session again
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (sessionError) {
          console.error(`[EventGallery] Session fetch error:`, sessionError);
        }
        
        retryCount++;
      }
      
      if (!accessToken) {
        console.log(`[EventGallery] No access token available after ${maxRetries} retries`);
        toast.dismiss(loadingToast);
        toast.error('Authentication required - please try logging out and back in');
        setIsUploading(false);
        return;
      }
      
      console.log('Access token retrieved, length:', accessToken.length);
      
      // Create form data
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('eventId', eventId);
      formData.append('caption', caption);
      
      // Upload image using regular gallery API with proper authentication
      console.log('Sending POST request to /api/events/gallery');
      const response = await fetch('/api/events/gallery', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
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
  }, [eventId, selectedImage, caption, session, setIsModalOpen, supabase.auth]);

  // Function to update image caption
  const updateImageCaption = React.useCallback(async (imageId, newCaption) => {
    setIsUpdatingCaption(true);
    
    try {
      let accessToken = session?.access_token;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!accessToken && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (sessionError) {
          console.error('Session fetch error:', sessionError);
        }
        retryCount++;
      }
      
      if (!accessToken) {
        toast.error('Authentication required');
        return;
      }
      
      const response = await fetch('/api/events/gallery', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          imageId,
          caption: newCaption.trim() || null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update caption');
      }
      
      const result = await response.json();
      
      // Update the image in the local state
      setImages(prevImages => 
        prevImages.map(img => 
          img.id === imageId 
            ? { ...img, caption: result.image.caption }
            : img
        )
      );
      
      toast.success('Caption updated successfully');
      setEditingImageId(null);
      setEditCaption('');
    } catch (error) {
      console.error('Error updating caption:', error);
      toast.error(error.message || 'Failed to update caption');
    } finally {
      setIsUpdatingCaption(false);
    }
  }, [session, supabase]);

  // Handle edit button click
  const handleEditCaption = React.useCallback((image) => {
    setEditingImageId(image.id);
    setEditCaption(image.caption || '');
  }, []);

  // Handle cancel edit
  const handleCancelEdit = React.useCallback(() => {
    setEditingImageId(null);
    setEditCaption('');
  }, []);

  // Memoize the delete function to maintain a stable reference
  const deleteImage = React.useCallback(async (e, imageId) => {
    e.stopPropagation(); // Prevent opening slideshow when clicking delete
    
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }
    
    const loadingToast = toast.loading('Deleting image...');
    
    try {
      // Wait for session to be available - retry up to 3 times with shorter intervals
      let accessToken = session?.access_token;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!accessToken && retryCount < maxRetries) {
        console.log(`[EventGallery Delete] Waiting for session... attempt ${retryCount + 1}/${maxRetries}`);
        
        // Wait a bit and try to get the session again
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (sessionError) {
          console.error(`[EventGallery Delete] Session fetch error:`, sessionError);
        }
        
        retryCount++;
      }
      
      if (!accessToken) {
        console.log(`[EventGallery Delete] No access token available after ${maxRetries} retries`);
        toast.dismiss(loadingToast);
        toast.error('Authentication required - please try logging out and back in');
        return;
      }
      
      console.log('Access token for delete retrieved, length:', accessToken.length);
      
      console.log('Sending DELETE request for image:', imageId);
      const response = await fetch(`/api/events/gallery?imageId=${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
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
  }, [images, currentSlideIndex, slideshowOpen, closeSlideshow, session, supabase.auth]);

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

  // Instead of re-rendering on every slide change, keep a stable reference - UNUSED
  // const onSlideLoaded = () => setSlideLoaded(true);
  // const onSlideError = () => setSlideLoaded(true);

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
                    onEdit={handleEditCaption}
                    isAdmin={isAdmin}
                    isEditing={editingImageId === image.id}
                    editCaption={editCaption}
                    onEditCaptionChange={setEditCaption}
                    onSaveEdit={updateImageCaption}
                    onCancelEdit={handleCancelEdit}
                    isUpdatingCaption={isUpdatingCaption}
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

// Don't memoize the main component - it needs to re-render when user context changes
export default EventGallery;