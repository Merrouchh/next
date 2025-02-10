import { motion } from 'framer-motion';
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
      <motion.div 
        className={styles.heroContent}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Logo Section */}
        <motion.div 
          className={styles.logoContainer}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          {/* Desktop Logo */}
          <div className={styles.desktopLogo}>
            <Image
              src="/logomobile.png"
              alt="Merrouch Gaming"
              width={220}
              height={110}
              priority
              className={styles.brandLogo}
            />
          </div>

          {/* Mobile Text Logo */}
          <div className={styles.mobileLogo}>
            <span className={styles.welcome}>Welcome To</span>
            <div>
              <span className={styles.merrouch}>Merrouch</span>{' '}
              <span className={styles.gaming}>Gaming</span>
            </div>
          </div>
        </motion.div>

        {/* Gaming Stats */}
        <motion.div 
          className={styles.statsContainer}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <div className={styles.statBox}>
            <FaGamepad className={styles.statIcon} />
            <div className={styles.statInfo}>
              <span className={styles.statValue}>14</span>
              <span className={styles.statLabel}>GAMING STATIONS</span>
            </div>
          </div>
          <div className={styles.divider} />
          <div className={styles.statBox}>
            <FaBolt className={styles.statIcon} />
            <div className={styles.statInfo}>
              <span className={styles.statValue}>200</span>
              <span className={styles.statLabel}>MBPS SPEED</span>
            </div>
          </div>
          <div className={styles.divider} />
          <div className={styles.statBox}>
            <FaTrophy className={styles.statIcon} />
            <div className={styles.statInfo}>
              <span className={styles.statValue}>7 / 7</span>
              <span className={styles.statLabel}>OPEN DAILY</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>

    {/* Gallery Section */}
    <section className={styles.gallerySection}>
      <div className={styles.galleryGrid}>
        {GALLERY_IMAGES.map((image, index) => (
          <motion.div
            key={index}
            className={styles.galleryImage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 * index, duration: 0.8 }}
            whileHover={{ 
              scale: 1.03,
              transition: { duration: 0.3 }
            }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0}
              className={styles.imageOverlay}
              quality={100}
              sizes="(max-width: 768px) 100vw, 33vw"
              placeholder="blur"
              blurDataURL={image.blurDataURL}
              style={{ objectFit: 'cover' }}
            />
            <motion.div 
              className={styles.imageCaption}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 * index, duration: 0.8 }}
            >
              <h3>{image.title}</h3>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Call to Action Section */}
    <section className={styles.ctaSection}>
      <motion.div 
        className={styles.ctaContainer}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
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
      </motion.div>
    </section>
  </>
);

export default HeroSection; 