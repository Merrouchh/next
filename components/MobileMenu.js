import { memo } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/MobileHeader.module.css';

const MobileMenu = memo(({ isOpen, children }) => {
  if (typeof window === 'undefined') return null;
  
  return createPortal(
    <>
      {isOpen && <div className={styles.mobileMenuBackdrop} />}
      <div className={`${styles.mobileMenuPortal} ${isOpen ? styles.open : ''}`}>
        {children}
      </div>
    </>,
    document.body
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu; 