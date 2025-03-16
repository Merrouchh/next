import { memo } from 'react';
import { createPortal } from 'react-dom';
import styles from '../styles/Header.module.css';

const MobileMenu = memo(({ isOpen, children }) => {
  if (typeof window === 'undefined') return null;
  
  return createPortal(
    <div className={`${styles.mobileMenuPortal} ${isOpen ? styles.open : ''}`}>
      {children}
    </div>,
    document.body
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu; 