import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import styles from '../styles/DarkModeMap.module.css';

const DarkModeMap = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const router = useRouter();
  const mountedRef = useRef(true);
  const initTimeoutRef = useRef(null);
  const leafletRef = useRef(null);

  // Only render after component is mounted to prevent SSR issues
  useEffect(() => {
    setShouldRender(true);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Clean up on route changes to prevent chunk loading errors
  useEffect(() => {
    const handleRouteChangeStart = () => {
      mountedRef.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
          mapInstance.current = null;
        } catch (error) {
          console.warn('Error cleaning up map on route change:', error);
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router.events]);

  // Memoized function to load Leaflet safely
  const loadLeaflet = useCallback(async () => {
    if (leafletRef.current) {
      return leafletRef.current;
    }

    try {
      const leafletModule = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      leafletRef.current = leafletModule.default;
      return leafletRef.current;
    } catch (error) {
      console.error('Failed to load Leaflet:', error);
      setLoadError(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldRender || loadError) return;
    
    const initializeMap = async () => {
      try {
        // Double check we're still mounted and have a ref
        if (!mapRef.current || !mountedRef.current) return;

        // Load Leaflet with error handling
        let L;
        try {
          L = await loadLeaflet();
        } catch (importError) {
          console.error('Failed to import leaflet:', importError);
          if (mountedRef.current) {
            setIsLoading(false);
            setLoadError(true);
          }
          return;
        }

        // Check again after async operations
        if (!mapRef.current || !mountedRef.current || !L) return;

        // Clean up any existing map instance
        if (mapInstance.current) {
          try {
            mapInstance.current.remove();
          } catch (error) {
            console.warn('Error removing existing map:', error);
          }
          mapInstance.current = null;
        }

        mapInstance.current = L.map(mapRef.current, {
          center: [35.768685, -5.810158],
          zoom: 16,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance.current);

        const customIcon = L.divIcon({
          className: styles.markerIcon,
          html: `
            <div class="${styles.markerContainer}">
              <a href="https://www.google.com/maps/place/Cyber+Gaming+Merrouch/@35.7686889,-5.8127333,922m/data=!3m1!1e3!4m14!1m7!3m6!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!2sCyber+Gaming+Merrouch!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1!3m5!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1?entry=ttu&g_ep=EgoyMDI1MDExMC4wIKXMDSoASAFQAw%3D%3D" target="_blank" class="${styles.tooltip}">Click Me</a>
              <img src="/logomobile.png" class="${styles.markerLogo}" alt="Merrouch Gaming" />
              <div class="${styles.markerRing}"></div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        });

        L.marker([35.768685, -5.810158], {
          icon: customIcon,
        }).addTo(mapInstance.current);

        initTimeoutRef.current = setTimeout(() => {
          if (mapInstance.current && mountedRef.current) {
            try {
              // Use requestAnimationFrame to prevent forced reflow
              requestAnimationFrame(() => {
                if (mapInstance.current && mountedRef.current) {
                  try {
                    mapInstance.current.invalidateSize();
                  } catch (error) {
                    console.warn('Error invalidating map size:', error);
                  }
                }
              });
            } catch (error) {
              console.warn('Error scheduling map size invalidation:', error);
            }
          }
          if (mountedRef.current) {
            setIsLoading(false);
          }
        }, 100);

      } catch (error) {
        console.error('Map initialization error:', error);
        if (mountedRef.current) {
          setIsLoading(false);
          setLoadError(true);
        }
      }
    };

    const timer = setTimeout(initializeMap, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
      if (mapInstance.current) {
        try {
          mapInstance.current.remove();
          mapInstance.current = null;
        } catch (error) {
          console.warn('Error cleaning up map:', error);
        }
      }
    };
  }, [shouldRender, loadLeaflet, loadError]);

  // Don't render if not ready or if component is unmounting
  if (!shouldRender || !mountedRef.current) {
    return (
      <div className={styles.mapWrapper}>
        <div className={styles.mapLoading}>Loading map...</div>
      </div>
    );
  }

  // Show error state if map failed to load
  if (loadError) {
    return (
      <div className={styles.mapWrapper}>
        <div className={styles.mapError}>
          <p>Map is temporarily unavailable</p>
          <p>Visit us at: Rue Tanger, Tangier, Morocco</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapWrapper}>
      {isLoading && (
        <div className={styles.mapLoading}>Loading map...</div>
      )}
      <div ref={mapRef} className={styles.mapContainer} />
    </div>
  );
};

export default DarkModeMap;
