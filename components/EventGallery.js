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

// Create a virtualized thumbnail component
const GalleryThumbnail = ({ image, index, onClick, onDelete, isAdmin }) => {
  // Use intersection observer to only load images when they're visible
  const [ref, inView] = useInView({
    triggerOnce: false,
    rootMargin: '200px 0px', // Load images 200px before they enter viewport
    threshold: 0.1
  });

  return (
    <div 
      ref={ref}
      className={styles.galleryItem}
      onClick={onClick}
    >
      <div className={styles.imageContainer}>
        {inView ? (
          <Image 
            src={image.image_url} 
            alt={image.caption || 'Event gallery image'} 
            className={styles.galleryImage}
            fill
            sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAEhQJ/hELJ4wAAAABJRU5ErkJggg=="
            priority={index < 8} // Prioritize loading first 8 images
            loading={index < 8 ? "eager" : "lazy"}
          />
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
  
  const { user, supabase } = useAuth();
  const fileInputRef = useRef(null);

  // Check if user is an admin
  const isAdmin = user?.isAdmin || false;

  // Chunking implementation for large galleries
  const CHUNK_SIZE = 20; // Load images in chunks of 20
  const [visibleChunks, setVisibleChunks] = useState(1);
  const [hasMoreChunks, setHasMoreChunks] = useState(true);

  // Fetch gallery images
  useEffect(() => {
    fetchGalleryImages();
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

  // Intersection observer to detect when user scrolls to bottom to load more chunks
  const [loadMoreRef, loadMoreInView] = useInView({
    threshold: 0.1,
    rootMargin: '200px 0px',
  });

  // Load more images when user scrolls to bottom
  useEffect(() => {
    if (loadMoreInView && hasMoreChunks) {
      loadNextChunk();
    }
  }, [loadMoreInView, hasMoreChunks]);

  const loadNextChunk = useCallback(() => {
    setVisibleChunks(prev => {
      const nextValue = prev + 1;
      // Check if we've loaded all images
      if (nextValue * CHUNK_SIZE >= images.length) {
        setHasMoreChunks(false);
      }
      return nextValue;
    });
  }, [images.length]);

  const fetchGalleryImages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/gallery?eventId=${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
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
      console.error('Error fetching gallery:', error);
      toast.error('Could not load gallery images');
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
    setSlideLoaded(false); // Reset loading state
    setSlideshowOpen(true);
  };
  
  const closeSlideshow = () => {
    setSlideshowOpen(false);
  };
  
  const showNextSlide = () => {
    setSlideLoaded(false); // Reset loading state
    setCurrentSlideIndex((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
    );
  };
  
  const showPreviousSlide = () => {
    setSlideLoaded(false); // Reset loading state
    setCurrentSlideIndex((prev) => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  // Preload adjacent images to make slideshow navigation faster
  useEffect(() => {
    if (!slideshowOpen || images.length <= 1) return;
    
    const preloadImage = (index) => {
      // Use the native Image constructor, not the Next.js Image component
      const img = new window.Image();
      img.src = images[index].image_url;
    };
    
    // Preload next image
    const nextIndex = currentSlideIndex === images.length - 1 ? 0 : currentSlideIndex + 1;
    preloadImage(nextIndex);
    
    // Preload previous image
    const prevIndex = currentSlideIndex === 0 ? images.length - 1 : currentSlideIndex - 1;
    preloadImage(prevIndex);
  }, [currentSlideIndex, slideshowOpen, images]);

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
                  <FaSpinner className={styles.spinnerIcon} />
                  <p>Loading more images...</p>
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
                  
                  <Image 
                    src={images[currentSlideIndex].image_url} 
                    alt={images[currentSlideIndex].caption || 'Gallery image'} 
                    className={`${styles.slideImage} ${slideLoaded ? styles.slideImageLoaded : ''}`}
                    fill
                    sizes="95vw"
                    quality={100}
                    priority={true}
                    onLoadingComplete={() => setSlideLoaded(true)}
                    style={{ objectFit: 'contain' }}
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