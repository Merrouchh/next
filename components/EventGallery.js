import { useState, useEffect, useRef, useCallback } from 'react';
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
import Image from 'next/image';
import styles from '../styles/EventGallery.module.css';
import { useAuth } from '../contexts/AuthContext';
import { useInView } from 'react-intersection-observer';

// Add debounce utility at the top of file, after imports
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Simplified slideshow image component with fallback
const SlideshowImage = ({ image, onLoaded, onError }) => {
  const [imageError, setImageError] = useState(false);
  const [isCached, setIsCached] = useState(false);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery image` 
    : `Event gallery image ${image.id}`;
  
  // Check if image is in browser cache when component mounts
  useEffect(() => {
    let isMounted = true;
    let imgElement = null;
    
    const checkCache = () => {
      // Create a standard HTML image element instead of using Image constructor
      imgElement = document.createElement('img');
      imgElement.onload = () => {
        if (isMounted) {
          setIsCached(true);
          // Immediately notify parent component if image was cached
          onLoaded();
        }
      };
      imgElement.src = image.image_url;
    };
    
    checkCache();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      if (imgElement) {
        imgElement.onload = null;
        imgElement.onerror = null;
        imgElement = null;
      }
    };
  }, [image.image_url, onLoaded]);
  
  return (
    <>
      {!imageError ? (
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <img 
            src={image.image_url} 
            alt={imageAlt}
            title={imageTitle}
            className={styles.slideImage}
            style={{ 
              maxWidth: '95%', 
              maxHeight: '80vh', 
              objectFit: 'contain'
            }}
            decoding="async"
            // Only trigger onLoad if not already cached
            onLoad={() => !isCached && onLoaded()}
            onError={() => {
              console.log('Slideshow image failed to load:', image.image_url);
              setImageError(true);
              onError();
            }}
          />
        </div>
      ) : (
        // Fallback to placeholder if image fails
        <div className={styles.imagePlaceholder}>
          <FaImage size={48} />
          <p>Image not available</p>
        </div>
      )}
    </>
  );
};

// Simplified gallery thumbnail component
const GalleryThumbnail = ({ image, index, onClick, onDelete, isAdmin }) => {
  // Use intersection observer with larger threshold for smoother scrolling
  const [ref, inView] = useInView({
    triggerOnce: true,
    rootMargin: '300px 0px', // Increased from 200px to 300px
    threshold: 0.01, // Reduced threshold for earlier loading
  });
  
  // Add state to track image loading
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create proper alt text and title for SEO
  const imageTitle = image.caption || `Event image ${image.id}`;
  const imageAlt = image.caption 
    ? `${image.caption} - Event gallery thumbnail` 
    : `Event gallery thumbnail ${image.id}`;
  
  // Check if this image is already in browser cache - with simpler implementation
  useEffect(() => {
    if (!inView || imageError) return;
    
    let isMounted = true;
    let imgElement = null;
    
    // Simplified cache check with requestIdleCallback for better performance
    const checkCache = () => {
      // Use requestIdleCallback where available or fallback to setTimeout
      const runWhenIdle = window.requestIdleCallback || 
        ((fn) => setTimeout(fn, 1));
        
      runWhenIdle(() => {
        if (!isMounted) return;
        
        // Create standard HTML image element
        imgElement = document.createElement('img');
        imgElement.onload = () => {
          if (isMounted) setIsLoading(false);
        };
        imgElement.onerror = () => {
          if (isMounted) console.error('Image cache check failed:', image.image_url);
        };
        imgElement.src = image.image_url;
      });
    };
    
    checkCache();
    
    return () => {
      isMounted = false;
      if (imgElement) {
        imgElement.onload = null;
        imgElement.onerror = null;
        imgElement = null;
      }
    };
  }, [inView, imageError, image.image_url]);

  return (
    <div 
      ref={ref}
      className={styles.galleryItem}
      onClick={onClick}
    >
      <div className={styles.imageContainer}>
        {inView ? (
          <>
            {/* Show spinner while loading */}
            {isLoading && !imageError && (
              <div className={styles.thumbnailLoading}>
                <FaSpinner className={styles.spinnerIcon} />
              </div>
            )}
            
            {/* Simple img tag instead of Next.js Image */}
            {!imageError ? (
              <img 
                src={image.image_url} 
                alt={imageAlt}
                title={imageTitle}
                className={styles.galleryImage}
                style={{ 
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  willChange: 'transform', // Add will-change for better rendering performance
                }}
                loading="lazy"
                decoding="async"
                fetchpriority="low"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  console.error('Image failed to load:', image.image_url);
                  setImageError(true);
                  setIsLoading(false);
                }}
              />
            ) : (
              // Fallback to placeholder if image fails
              <div className={styles.thumbnailPlaceholder}>
                <FaImage />
              </div>
            )}
          </>
        ) : (
          // Empty div with same aspect ratio while not in view
          <div style={{ width: '100%', paddingBottom: '56.25%', backgroundColor: '#222' }} />
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
      {image.caption && (
        <div className={styles.imageCaption}>
          {image.caption}
        </div>
      )}
    </div>
  );
};

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
  
  // Track if page is visible
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  const { user, supabase } = useAuth();
  const fileInputRef = useRef(null);

  // Check if user is an admin
  const isAdmin = user?.isAdmin || false;

  // Track page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Chunking implementation for large galleries - reduced to load fewer at once
  const CHUNK_SIZE = 4; // Further reduced from 5 to 4 to decrease rendering work
  const [visibleChunks, setVisibleChunks] = useState(1);
  const [hasMoreChunks, setHasMoreChunks] = useState(true);
  const [loadingChunk, setLoadingChunk] = useState(false);
  const throttleTimerRef = useRef(null);

  // Intersection observer with better performance settings
  const [loadMoreRef, loadMoreInView] = useInView({
    threshold: 0.01, // Reduced threshold for earlier loading
    rootMargin: '500px 0px', // Increased from 400px to 500px
    triggerOnce: false
  });

  // Create debounced load function to prevent too many state updates
  const debouncedLoadNextChunk = useCallback(
    debounce(() => {
      if (loadingChunk || !hasMoreChunks || !isPageVisible) return;
      loadNextChunk();
    }, 150), // 150ms debounce
    [loadingChunk, hasMoreChunks, isPageVisible]
  );

  // Load more images when user scrolls to bottom with debounce
  useEffect(() => {
    if (loadMoreInView) {
      debouncedLoadNextChunk();
    }
  }, [loadMoreInView, debouncedLoadNextChunk]);

  const loadNextChunk = useCallback(() => {
    // Prevent loading if already loading
    if (loadingChunk) return;
    
    // Also add throttling to prevent rapid consecutive loads
    if (throttleTimerRef.current) return;
    
    setLoadingChunk(true);
    
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      setVisibleChunks(prev => {
        const nextValue = prev + 1;
        // Check if we've loaded all images
        if (nextValue * CHUNK_SIZE >= images.length) {
          setHasMoreChunks(false);
        }
        return nextValue;
      });
      
      // Set a timer to prevent another load for a short period
      throttleTimerRef.current = setTimeout(() => {
        setLoadingChunk(false);
        throttleTimerRef.current = null;
      }, 250);
    });
  }, [images.length, loadingChunk]);

  // Clean up throttle timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  // Fetch gallery images
  useEffect(() => {
    fetchGalleryImages();
    
    // Cleanup any pending image loads when unmounting
    return () => {
      setImages([]);
    };
  }, [eventId]);
  
  // Handle keyboard navigation for slideshow
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
  }, [slideshowOpen, currentSlideIndex, images]);

  const fetchGalleryImages = async () => {
    setIsLoading(true);
    try {
      // Simple fetch with a 15-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      // Add a cache-busting parameter for the API request, but not for images themselves
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
      
      // Reset chunking state
      setVisibleChunks(1);
      setHasMoreChunks(galleryImages.length > CHUNK_SIZE);
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

  // Handle file selection
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

  // Upload image
  const uploadImage = async (e) => {
    e.preventDefault();
    
    if (!selectedImage) {
      toast.error('Please select an image to upload');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('image', selectedImage);
      formData.append('eventId', eventId);
      formData.append('caption', caption);
      
      // Upload image
      const response = await fetch('/api/events/gallery', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }
      
      const data = await response.json();
      
      // Add new image to the gallery
      setImages(prevImages => [data.image, ...prevImages]);
      
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
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  // Delete image
  const deleteImage = async (e, imageId) => {
    e.stopPropagation(); // Prevent opening slideshow when clicking delete
    
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }
    
    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`/api/events/gallery?imageId=${imageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete image');
      }
      
      // Remove deleted image from the state
      setImages(prevImages => prevImages.filter(image => image.id !== imageId));
      
      // If currently in slideshow mode and the deleted image is displayed, close slideshow
      if (slideshowOpen && images[currentSlideIndex]?.id === imageId) {
        closeSlideshow();
      }
      
      toast.success('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error(error.message || 'Failed to delete image');
    }
  };

  // Open upload modal
  const openModal = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCaption('');
    setIsModalOpen(true);
  };

  // Close upload modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
    setImagePreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Slideshow functions
  const openSlideshow = (index) => {
    setCurrentSlideIndex(index);
    setSlideLoaded(false);
    setSlideshowOpen(true);
  };
  
  const closeSlideshow = () => {
    setSlideshowOpen(false);
  };
  
  const showNextSlide = () => {
    setSlideLoaded(false);
    setCurrentSlideIndex((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  };
  
  const showPreviousSlide = () => {
    setSlideLoaded(false);
    setCurrentSlideIndex((prev) => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  // If there are no images and user is not admin, don't show anything
  if (images.length === 0 && !isAdmin && !isLoading) {
    return null;
  }

  // Get visible images based on chunking
  const visibleImages = images.slice(0, visibleChunks * CHUNK_SIZE);

  return (
    <div className={styles.galleryContainer}>
      <h2 className={styles.galleryTitle}>
        <FaImage className={styles.galleryIcon} /> EVENT GALLERY
      </h2>
      <hr className={styles.galleryHorizontalRule} />
      
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <FaSpinner className={styles.spinnerIcon} />
          <p>Loading gallery...</p>
        </div>
      ) : (
        <>
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
          
          {images.length === 0 ? (
            <div className={styles.emptyGallery}>
              <p>No images in the gallery yet.</p>
              {isAdmin && <p>Use the "Add Image" button to upload images to the event gallery.</p>}
            </div>
          ) : (
            <>
              <div className={styles.galleryGrid}>
                {visibleImages.map((image, index) => (
                  <GalleryThumbnail
                    key={image.id}
                    image={image}
                    index={index}
                    onClick={() => openSlideshow(index)}
                    onDelete={deleteImage}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
              
              {/* Load more reference element */}
              {hasMoreChunks && (
                <div ref={loadMoreRef} className={styles.loadMoreContainer}>
                  {loadingChunk ? (
                    <>
                      <FaSpinner className={styles.spinnerIcon} />
                      <p>Loading more images...</p>
                    </>
                  ) : (
                    <p>Scroll for more</p>
                  )}
                </div>
              )}
            </>
          )}
          
          {/* Upload Modal */}
          {isModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <h3>Add Gallery Image</h3>
                  <button 
                    className={styles.closeButton}
                    onClick={closeModal}
                    aria-label="Close"
                  >
                    <FaTimes />
                  </button>
                </div>
                
                <form onSubmit={uploadImage} className={styles.uploadForm}>
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
                      onClick={closeModal}
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
            </div>
          )}
          
          {/* Slideshow Modal */}
          {slideshowOpen && images.length > 0 && (
            <div className={styles.slideModalOverlay} onClick={closeSlideshow}>
              <div className={styles.slideModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.slideModalHeader}>
                  <button 
                    className={styles.slideModalCloseButton}
                    onClick={closeSlideshow}
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
                    image={images[currentSlideIndex]}
                    onLoaded={() => setSlideLoaded(true)}
                    onError={() => setSlideLoaded(true)} // Still mark as loaded on error to remove spinner
                  />
                  
                  {images.length > 1 && (
                    <>
                      <button 
                        className={`${styles.slideNavButton} ${styles.prevButton}`}
                        onClick={showPreviousSlide}
                        aria-label="Previous image"
                      >
                        <FaArrowLeft />
                      </button>
                      
                      <button 
                        className={`${styles.slideNavButton} ${styles.nextButton}`}
                        onClick={showNextSlide}
                        aria-label="Next image"
                      >
                        <FaArrowRight />
                      </button>
                    </>
                  )}
                </div>
                
                {images[currentSlideIndex].caption && (
                  <div className={styles.slideCaption}>
                    {images[currentSlideIndex].caption}
                  </div>
                )}
                
                <div className={styles.slideCounter}>
                  {currentSlideIndex + 1} / {images.length}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventGallery; 