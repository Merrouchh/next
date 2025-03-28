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
  FaExpand
} from 'react-icons/fa';
import { createPortal } from 'react-dom';
import styles from '../styles/EventGallery.module.css';
import { useAuth } from '../contexts/AuthContext';

// Simplified slideshow image component with fallback, wrapped in React.memo
const SlideshowImage = React.memo(({ image, onLoaded, onError }) => {
  const [imageError, setImageError] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery image` 
    : `Event gallery image ${image.id}`;
  
  // Handle image load with slight delay to ensure rendering
  const handleImageLoad = () => {
    setIsImageLoaded(true);
    // Use setTimeout to ensure browser has time to paint
    setTimeout(() => {
          onLoaded();
    }, 10);
  };
  
  return (
    <>
      {!imageError ? (
          <img 
            src={image.image_url} 
            alt={imageAlt}
            title={imageTitle}
          className={`${styles.slideImage} ${isImageLoaded ? styles.visible : styles.hidden}`}
            decoding="async"
          onLoad={handleImageLoad}
            onError={() => {
              console.log('Slideshow image failed to load:', image.image_url);
              setImageError(true);
              onError();
            }}
          style={{
            transform: 'translateZ(0)', // Force GPU acceleration
            backfaceVisibility: 'hidden', // Prevent flickering
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
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkIfMobile = () => {
        setIsMobile(window.innerWidth <= 767);
      };
      
      checkIfMobile();
      window.addEventListener('resize', checkIfMobile);
      
      return () => {
        window.removeEventListener('resize', checkIfMobile);
      };
    }
  }, []);
  
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
  
  if (!isOpen || !images.length) return null;
  
  const onSlideLoaded = () => setSlideLoaded(true);
  const onSlideError = () => setSlideLoaded(true);
  
  // Only render portal on client side
  if (typeof window === 'undefined') return null;
  
  return createPortal(
    <div className={styles.slideshowPortal}>
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
  
  // Force a repaint when the image loads
  const handleImageLoad = () => {
    setIsLoading(false);
    // Slight delay to ensure DOM update before setting visible
    setTimeout(() => {
      setIsVisible(true);
    }, 10);
  };

  // Handle image load error
  const handleImageError = () => {
    console.error('Image failed to load:', image.image_url);
    setImageError(true);
    setIsLoading(false);
  };

  return (
    <div 
      className={styles.galleryItem}
      onClick={onClick}
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
            className={`${styles.galleryImage} ${isVisible ? styles.visible : styles.hidden}`}
                loading="lazy"
                decoding="async"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              transform: 'translateZ(0)', // Force GPU acceleration
              backfaceVisibility: 'hidden', // Enhance performance
                }}
              />
            ) : (
              // Fallback to placeholder if image fails
              <div className={styles.thumbnailPlaceholder}>
                <FaImage />
              </div>
        )}
        
        <FaExpand className={styles.expandIcon} />
        {isAdmin && (
          <button 
            className={styles.deleteButton} 
            onClick={(e) => onDelete(e, image.id)}
            aria-label="Delete image"
          >
            <FaTrashAlt />
          </button>
        )}
      </div>
      {/* Always render caption container to prevent layout shifts, just hide it if no caption */}
      <div className={styles.imageCaption} style={{ opacity: image.caption ? 1 : 0 }}>
        {image.caption || 'No caption'}
        </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the image changes
  return prevProps.image.id === nextProps.image.id;
});

// Create a separate component for the upload modal
const UploadModal = React.memo(({ isOpen, onClose, onSubmit, caption, setCaption, imagePreview, selectedImage, setSelectedImage, setImagePreview, fileInputRef, isUploading }) => {
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
const EventGallery = ({ eventId }) => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  
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
  }, []);

  // Upload image - memoized
  const uploadImage = React.useCallback(async (e) => {
    e.preventDefault();
    
    if (!selectedImage) {
      toast.error('Please select an image to upload');
      return;
    }
    
    setIsUploading(true);
    const loadingToast = toast.loading('Uploading image...');
    
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
      
      // Reset form
      setSelectedImage(null);
      setImagePreview(null);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Close modal
      setIsModalOpen(false);
      
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.dismiss(loadingToast);
      toast.error(error.message || 'Failed to upload image');
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
    if (!hasInitialCount || imageCount === 0) return null;
    
    const placeholders = [];
    for (let i = 0; i < imageCount; i++) {
      placeholders.push(<GalleryPlaceholder key={`placeholder-${i}`} />);
    }
    return placeholders;
  };

  // If there are no images and user is not admin, don't show anything
  if (imageCount === 0 && !isAdmin && !isLoading && hasInitialCount) {
    return null;
  }

  return (
    <div className={styles.galleryContainer}>
      <h2 className={styles.galleryTitle}>
        <FaImage className={styles.galleryIcon} /> EVENT GALLERY
      </h2>
      <hr className={styles.galleryHorizontalRule} />
      
      {isLoading && !hasInitialCount ? (
        <div className={styles.loadingContainer}>
          <FaSpinner className={styles.spinnerIcon} />
          <p>Loading gallery...</p>
        </div>
      ) : (
        <React.Fragment>
          {isAdmin && (
            <div className={styles.adminControls}>
              <button 
                className={styles.addImageButton} 
                onClick={openModal}
                aria-label="Add image to gallery"
              >
                <FaPlus /> Add Image
              </button>
            </div>
          )}
          
          {imageCount === 0 && hasInitialCount ? (
            <div className={styles.emptyGallery}>
              <p>No images in the gallery yet.</p>
              {isAdmin && <p>Use the "Add Image" button to upload images to the event gallery.</p>}
            </div>
          ) : (
            <div className={styles.galleryGrid} style={{ minHeight: `${Math.ceil(imageCount / 4) * 250}px` }}>
              {/* Show placeholder grid during the initial loading */}
              {isLoading && hasInitialCount ? (
                renderPlaceholders()
              ) : (
                /* Show actual images when loaded */
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
          
          {/* Upload Modal - rendered as portal at the document body level */}
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
          />
          
          {/* Slideshow Modal - rendered as portal at the document body level */}
          <SlideshowModal 
            isOpen={slideshowOpen}
            onClose={closeSlideshow}
            images={images}
            currentIndex={currentSlideIndex}
            onNext={showNextSlide}
            onPrevious={showPreviousSlide}
          />
        </React.Fragment>
      )}
    </div>
  );
};

export default React.memo(EventGallery); 