import Image from 'next/image';
import { FaGamepad, FaTrophy, FaBolt } from 'react-icons/fa';
import styles from '../styles/Home.module.css';

const GALLERY_IMAGES = [
  { 
    src: '/top.jpg', 
    alt: 'High-End Gaming Setup',
    title: 'Premium Gaming Experience',
    blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTAxMTIwPURCNz5GPjIxTU9HRVBVX1xfOENoa2hvRlFfX1X/2wBDARUXFx4aHR4eHVVNJzEnVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=' 
  },
  { 
    src: '/top2.jpg', 
    alt: 'Professional Gaming Environment',
    title: 'Professional Environment',
    blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTAxMTIwPURCNz5GPjIxTU9HRVBVX1xfOENoa2hvRlFfX1X/2wBDARUXFx4aHR4eHVVNJzEnVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=' 
  },
  { 
    src: '/top3.jpg', 
    alt: 'Gaming Community Space',
    title: 'Community Gaming',
    blurDataURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSAyVC08MTAxMTIwPURCNz5GPjIxTU9HRVBVX1xfOENoa2hvRlFfX1X/2wBDARUXFx4aHR4eHVVNJzEnVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=' 
  }
];

const HeroSection = ({ onCheckAvailability, router }) => (
  <>
    {/* Hero Section */}
    <section className={styles.heroSection}>
      <div className={styles.heroContent}>
        {/* Logo Section - Hidden on mobile */}
        <div className={styles.logoContainer}>
          {/* Logo for desktop only */}
          <div className={styles.brandLogoContainer}>
            <Image
              src="/logomobile.png"
              alt="Merrouch Gaming"
              width={200}
              height={200}
              priority
              className={styles.brandLogo}
              sizes="(max-width: 768px) 0px, 200px"
            />
          </div>
        </div>

        {/* Gaming Stats */}
        <div className={styles.statsContainer}>
          <div className={styles.statBox}>
            <div className={styles.iconWrapper}>
              <FaGamepad className={styles.statIcon} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>14</span>
              <span className={styles.statLabel}>Gaming Stations</span>
            </div>
          </div>
          
          <div className={styles.statBox}>
            <div className={styles.iconWrapper}>
              <FaBolt className={styles.statIcon} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>200</span>
              <span className={styles.statLabel}>Mbps Speed</span>
            </div>
          </div>
          
          <div className={styles.statBox}>
            <div className={styles.iconWrapper}>
              <FaTrophy className={styles.statIcon} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>7/7</span>
              <span className={styles.statLabel}>Open Daily</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Gallery Section */}
    <section className={styles.gallerySection}>
      <div className={styles.galleryGrid}>
        {GALLERY_IMAGES.map((image, index) => (
          <div
            key={index}
            className={styles.galleryImage}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0}
              className={styles.imageOverlay}
              quality={75}
              sizes="(max-width: 768px) 362px, 362px"
              placeholder="blur"
              blurDataURL={image.blurDataURL}
              style={{ objectFit: 'cover' }}
            />
            <div className={styles.imageCaption}>
              <h3>{image.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Call to Action Section */}
    <section className={styles.ctaSection}>
      <div className={styles.ctaContainer}>
        <button 
          className={styles.primaryCta}
          onClick={onCheckAvailability}
        >
          <span className={styles.ctaGlow} />
          CHECK AVAILABILITY
        </button>
        <div className={styles.secondaryActions}>
          <button 
            className={styles.secondaryCta} 
            onClick={() => router.push('/shop')}
          >
            VIEW PRICES
          </button>
          <button 
            className={styles.secondaryCta} 
            onClick={() => router.push('/topusers')}
          >
            TOP PLAYERS
          </button>
        </div>
      </div>
    </section>
  </>
);

export default HeroSection; 