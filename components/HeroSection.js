import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { FaGamepad, FaTrophy, FaBolt, FaChevronRight, FaChevronLeft, FaWhatsapp } from 'react-icons/fa';
import { AiOutlinePhone, AiOutlineInstagram } from 'react-icons/ai';
import styles from '../styles/Home.module.css';

// Dynamically import Leaflet map component to avoid SSR issues
const LeafletMap = dynamic(() => import('./LeafletMapComponent'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map...</div>
});

const HERO_SLIDES = [
  {
    id: 1,
    image: '/top.jpg',
    title: 'Merrouch Gaming PC Center - Premium PC Gaming Experience in Tangier',
    subtitle: 'PC-Only Gaming Center | RTX 3070 Gaming PCs | Ryzen 7 7700 | 180Hz Monitors | Best PC Gaming Hub in Tangier, Morocco',
    stats: [
      { icon: FaGamepad, value: '14', label: 'PC Gaming Stations' },
      { icon: FaBolt, value: '200', label: 'Mbps Speed' },
      { icon: FaTrophy, value: '7/7', label: 'Open Daily' }
    ],
    type: 'hero'
  },
  {
    id: 2,
    image: '/top2.jpg',
    title: 'Our Location - Merrouch Gaming PC Center',
    subtitle: 'Find us on the map - Visit us at our gaming center in Tangier',
    type: 'location',
    location: {
      address: 'RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1, Tangier',
      latitude: 35.768787,
      longitude: -5.8102713
    }
  },
  {
    id: 3,
    image: '/top3.jpg',
    title: 'Contact Us - Merrouch Gaming PC Center',
    subtitle: 'Get in touch with us - Call, WhatsApp, or follow us on Instagram',
    type: 'contact',
    contact: {
      address: 'RDC, Avenue Abi Elhassan Chadili, rue 1 Résidence Rania 1, Tangier',
      phone: '0656053641',
      whatsapp: '0656053641',
      instagram: '@merrouchgaming',
      latitude: 35.768787,
      longitude: -5.8102713
    }
  },
  {
    id: 4,
    image: '/top3.jpg',
    title: 'Gaming PC Center Pricing - Affordable Gaming Packages',
    subtitle: 'Competitive Gaming Center Prices & Flexible Gaming Plans',
    type: 'packages',
    packages: [
      {
        title: 'Gaming Time',
        price: '18 Dh',
        period: '/hour',
        features: ['Premium Gaming PCs', 'High-Performance Hardware', 'Multiple Duration Options']
      },
      {
        title: 'All DAY Special',
        price: '110 Dh',
        period: '/24h',
        features: ['24 Hours of Gaming', 'Best Value Option', 'Premium Experience'],
        featured: true
      }
    ]
  }
];

const HeroSection = ({ router }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Navigation functions - defined first so they can be used in useEffect
  const goToSlide = useCallback((index) => {
    setCurrentSlide(index);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentSlide((prev) => prev === 0 ? HERO_SLIDES.length - 1 : prev - 1);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToPrevious, goToNext]);

  // Touch/swipe support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swipe left - go to next
      goToNext();
    } else if (distance < -minSwipeDistance) {
      // Swipe right - go to previous
      goToPrevious();
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const currentSlideData = HERO_SLIDES[currentSlide];

  const renderSlideContent = () => {
    if (currentSlideData.type === 'hero') {
      return null;
    }

    if (currentSlideData.type === 'location') {
      const { location } = currentSlideData;
      const googleMapsUrl = 'https://maps.app.goo.gl/9oMYgsuWMmW4ua2t5';
      
      return (
        <div className={styles.heroServicesContent}>
          {/* Navigate Button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.heroNavigateButton}
          >
            Click to Navigate
          </a>
          
          {/* Leaflet Dark Map - Only Map */}
          <div className={styles.heroMapContainer}>
            <LeafletMap
              latitude={location.latitude}
              longitude={location.longitude}
              address={location.address}
            />
          </div>
        </div>
      );
    }

    if (currentSlideData.type === 'contact') {
      const { contact } = currentSlideData;
      
      return (
        <div className={styles.heroServicesContent}>
          {/* Contact Information - Icon Cards */}
          <div className={styles.heroContactCard}>
            <div className={styles.heroContactGrid}>
              {/* Phone Card - Fully Clickable */}
              <a 
                href={`tel:${contact.phone}`}
                className={styles.heroContactIconCard}
              >
                <div className={styles.heroContactIconWrapper}>
                  <AiOutlinePhone size={32} />
                </div>
                <div className={styles.heroContactIconText}>
                  <span className={styles.heroContactIconLabel}>Phone</span>
                  <span className={styles.heroContactIconValue}>
                    {contact.phone}
                  </span>
                </div>
              </a>

              {/* WhatsApp Card - Fully Clickable */}
              <a 
                href={`https://wa.me/${contact.whatsapp.replace(/^0/, '212')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.heroContactIconCard}
              >
                <div className={styles.heroContactIconWrapper}>
                  <FaWhatsapp size={32} />
                </div>
                <div className={styles.heroContactIconText}>
                  <span className={styles.heroContactIconLabel}>WhatsApp</span>
                  <span className={styles.heroContactIconValue}>{contact.whatsapp}</span>
                </div>
              </a>

              {/* Instagram Card - Fully Clickable */}
              <a 
                href="https://instagram.com/merrouchgaming" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.heroContactIconCard}
              >
                <div className={styles.heroContactIconWrapper}>
                  <AiOutlineInstagram size={32} />
                </div>
                <div className={styles.heroContactIconText}>
                  <span className={styles.heroContactIconLabel}>Instagram</span>
                  <span className={styles.heroContactIconValue}>{contact.instagram}</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      );
    }

    if (currentSlideData.type === 'packages') {
      return (
        <div className={styles.heroPackagesContent}>
          <div className={styles.heroPackagesGrid}>
            {currentSlideData.packages.map((pkg, index) => (
              <div 
                key={index} 
                className={`${styles.heroPackageCard} ${pkg.featured ? styles.heroPackageFeatured : ''}`}
              >
                <div className={styles.heroPackageHeader}>
                  <h3>{pkg.title}</h3>
                  <div className={styles.heroPackagePrice}>
                    {pkg.price}<span>{pkg.period}</span>
                  </div>
                </div>
                <ul className={styles.heroPackageFeatures}>
                  {pkg.features.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
                {index === 0 && (
                  <button 
                    className={styles.heroPackageButton}
                    onClick={() => router.push('/shop')}
                  >
                    View All Pricing Options
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <section 
      className={styles.modernHeroSection}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Image */}
      <div className={styles.heroBackground}>
        <Image
          src={currentSlideData.image}
          alt={currentSlideData.title}
          fill
          priority
          quality={100}
          style={{ objectFit: 'cover' }}
          className={styles.heroImage}
          unoptimized={true}
          sizes="100vw"
        />
        {/* Dark Overlay */}
        <div className={styles.heroOverlay}></div>
      </div>

      {/* Content */}
      <div className={styles.heroContentWrapper}>
        <div className={styles.heroContent}>
          {/* Title */}
          <h1 className={styles.heroTitle}>
            {currentSlideData.title}
          </h1>
          <p className={styles.heroSubtitle}>
            {currentSlideData.subtitle}
          </p>

          {/* Dynamic Content Based on Slide Type */}
          {renderSlideContent()}
        </div>
      </div>

      {/* Navigation Arrows - Outside content wrapper for proper positioning */}
      <button 
        className={`${styles.heroNavArrow} ${styles.heroNavArrowLeft}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goToPrevious();
        }}
        aria-label="Previous slide"
        type="button"
      >
        <FaChevronLeft />
      </button>
      <button 
        className={`${styles.heroNavArrow} ${styles.heroNavArrowRight}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goToNext();
        }}
        aria-label="Next slide"
        type="button"
      >
        <FaChevronRight />
      </button>

      {/* Slide Indicators */}
      <div className={styles.heroSlideIndicators}>
        {HERO_SLIDES.map((_, index) => (
          <button
            key={index}
            className={`${styles.heroSlideDot} ${index === currentSlide ? styles.heroSlideDotActive : ''}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goToSlide(index);
            }}
            aria-label={`Go to slide ${index + 1}`}
            type="button"
          />
        ))}
      </div>
    </section>
  );
};

export default HeroSection; 