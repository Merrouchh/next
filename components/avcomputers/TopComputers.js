import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from '../../styles/avcomputers.module.css';
import { ComputerBox } from './ComputerBox';

// Top Computers section (Upper Floor)
export const TopComputers = ({
  computers,
  lastUpdate,
  highlightActive,
  onOpenLoginModal,
  userAlreadyLoggedIn,
  userCurrentComputer,
  isComputerLoaded,
  queueStatus,
  userInQueue,
  userIsNextForTop,
  userIsNextForBottom
}) => {
  const vipContainerRef = useRef(null);
  const [isAtEnd, setIsAtEnd] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  const [currentPair, setCurrentPair] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [cachedPairWidth, setCachedPairWidth] = useState(0);

  const totalPairs = Math.ceil(computers.length / 2) - 1;

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cache the pair width to avoid repeated clientWidth access
  useEffect(() => {
    if (!isMobile || !vipContainerRef.current) return;

    const updatePairWidth = () => {
      if (vipContainerRef.current) {
        setCachedPairWidth(vipContainerRef.current.clientWidth);
      }
    };

    updatePairWidth();

    // Use ResizeObserver for better performance
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updatePairWidth);
      resizeObserver.observe(vipContainerRef.current);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', updatePairWidth);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updatePairWidth);
      }
    };
  }, [isMobile]);

  // Only run scroll handling on mobile
  const handleScroll = useCallback((e) => {
    if (!isMobile || !e.target || !cachedPairWidth) return;

    const container = e.target;
    const currentScrollPosition = container.scrollLeft;
    const currentPairIndex = Math.round(currentScrollPosition / cachedPairWidth);

    setCurrentPair(currentPairIndex);
    setIsAtStart(currentPairIndex === 0);
    setIsAtEnd(currentPairIndex === totalPairs);
  }, [isMobile, totalPairs, cachedPairWidth]);

  const handleScrollButton = useCallback((direction) => {
    if (!isMobile || !vipContainerRef.current || !cachedPairWidth) return;

    const container = vipContainerRef.current;

    const newPairIndex = direction === 'left'
      ? Math.max(0, currentPair - 1)
      : Math.min(totalPairs, currentPair + 1);

    container.scrollTo({
      left: newPairIndex * cachedPairWidth,
      behavior: 'smooth'
    });

    setCurrentPair(newPairIndex);
    setIsAtStart(newPairIndex === 0);
    setIsAtEnd(newPairIndex === totalPairs);
  }, [isMobile, currentPair, totalPairs, cachedPairWidth]);

  useEffect(() => {
    const container = vipContainerRef.current;
    if (!container || !isMobile) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, isMobile]);

  return (
    <div className={styles.vipWrapper}>
      <div className={styles.vipSection}>
        <h2 className={styles.sectionHeading}>Top Computers</h2>
        <div className={styles.swipeControls}>
          <button
            onClick={() => handleScrollButton('left')}
            className={`${styles.swipeButton} ${isAtStart ? styles.edgeDisabled : ''}`}
            disabled={isAtStart}
          >
            <span className={styles.swipeArrow}>←</span>
          </button>

          <button
            onClick={() => handleScrollButton('right')}
            className={`${styles.swipeButton} ${isAtEnd ? styles.edgeDisabled : ''}`}
            disabled={isAtEnd}
          >
            <span className={styles.swipeArrow}>→</span>
          </button>
        </div>

        <div
          ref={vipContainerRef}
          className={styles.vipComputers}
        >
          {computers.map(computer => (
            <ComputerBox
              key={computer.id}
              computer={computer}
              isTopFloor={true}
              lastUpdate={lastUpdate}
              highlightActive={highlightActive}
              onOpenLoginModal={onOpenLoginModal}
              isLoading={!isComputerLoaded(computer.id)}
              userAlreadyLoggedIn={userAlreadyLoggedIn}
              userCurrentComputer={userCurrentComputer}
              queueStatus={queueStatus}
              userInQueue={userInQueue}
              userIsNextForTop={userIsNextForTop}
              userIsNextForBottom={userIsNextForBottom}
            />
          ))}
        </div>
      </div>
    </div>
  );
};


