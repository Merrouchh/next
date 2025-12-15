import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import styles from '../styles/HorizontalGallery.module.css';

const GALLERY_ITEMS = [
  {
    id: 1,
    src: '/top.jpg',
    alt: 'Premium Gaming Experience',
    title: 'Premium Gaming Experience',
    description: 'State-of-the-art gaming stations'
  },
  {
    id: 2,
    src: '/top2.jpg',
    alt: 'Professional Environment',
    title: 'Professional Environment',
    description: 'Competitive gaming atmosphere'
  },
  {
    id: 3,
    src: '/top3.jpg',
    alt: 'Community Gaming',
    title: 'Community Gaming',
    description: 'Join our gaming community'
  },
  {
    id: 4,
    src: '/top4.jpg',
    alt: 'High-End Equipment',
    title: 'High-End Equipment',
    description: 'RTX 3070 powered gaming PCs'
  }
];

const HorizontalGallery = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const scrollContainerRef = useRef(null);
  const autoPlayIntervalRef = useRef(null);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % GALLERY_ITEMS.length);
      }, 5000); // Change slide every 5 seconds
    }

    return () => {
      if (autoPlayIntervalRef.current) {
        clearInterval(autoPlayIntervalRef.current);
      }
    };
  }, [isAutoPlaying]);

  // Scroll to current slide
  useEffect(() => {
    if (scrollContainerRef.current) {
      const scrollPosition = currentIndex * scrollContainerRef.current.offsetWidth;
      scrollContainerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  const goToSlide = (index) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrevious = () => {
    const newIndex = currentIndex === 0 ? GALLERY_ITEMS.length - 1 : currentIndex - 1;
    goToSlide(newIndex);
  };

  const goToNext = () => {
    const newIndex = (currentIndex + 1) % GALLERY_ITEMS.length;
    goToSlide(newIndex);
  };

  const handleScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollLeft;
    const itemWidth = container.offsetWidth;
    const newIndex = Math.round(scrollPosition / itemWidth);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < GALLERY_ITEMS.length) {
      setCurrentIndex(newIndex);
      setIsAutoPlaying(false);
      setTimeout(() => setIsAutoPlaying(true), 10000);
    }
  };

  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <h2 className={styles.galleryTitle}>Explore Our Gaming Center</h2>
        <div className={styles.navigationDots}>
          {GALLERY_ITEMS.map((_, index) => (
            <button
              key={index}
              className={`${styles.dot} ${index === currentIndex ? styles.active : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.galleryContainer}>
        <button
          className={styles.navButton}
          onClick={goToPrevious}
          aria-label="Previous slide"
        >
          <FaChevronLeft />
        </button>

        <div
          ref={scrollContainerRef}
          className={styles.scrollContainer}
          onScroll={handleScroll}
        >
          <div className={styles.galleryTrack}>
            {GALLERY_ITEMS.map((item, index) => (
              <div key={item.id} className={styles.galleryItem}>
                <div className={styles.imageWrapper}>
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    quality={100}
                    priority={index === 0}
                    style={{ objectFit: 'cover' }}
                    className={styles.galleryImage}
                  />
                  <div className={styles.imageOverlay}></div>
                </div>
                <div className={styles.itemContent}>
                  <h3 className={styles.itemTitle}>{item.title}</h3>
                  <p className={styles.itemDescription}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          className={styles.navButton}
          onClick={goToNext}
          aria-label="Next slide"
        >
          <FaChevronRight />
        </button>
      </div>
    </section>
  );
};

export default HorizontalGallery;

