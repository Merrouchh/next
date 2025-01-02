import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from '../styles/DarkModeMap.module.css';

const DarkModeMap = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const isInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for the DOM to be ready
    if (typeof window === 'undefined') return;

    const initializeMap = async () => {
      try {
        // Check if container exists
        if (!mapRef.current) {
          console.error('Map container not found');
          return;
        }

        // Prevent multiple initializations
        if (isInitialized.current) return;

        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        // Double check container still exists after imports
        if (!mapRef.current) {
          console.error('Map container lost after initialization');
          return;
        }

        isInitialized.current = true;
        
        // Initialize map
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

        // Add tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapInstance.current);

        // Add custom marker
        const customIcon = L.divIcon({
          className: styles.markerIcon,
          html: `
            <div class="${styles.markerContainer}">
              <a href="https://www.google.com/maps/place/Cyber+Gaming+Merrouch/@35.7717735,-5.8325747,7380m/" target="_blank" class="${styles.tooltip}">Click Me</a>
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

        // Force a resize to ensure proper rendering
        setTimeout(() => {
          mapInstance.current?.invalidateSize();
          setIsLoading(false);
        }, 250);

      } catch (error) {
        console.error('Map initialization error:', error);
        setIsLoading(false);
      }
    };

    // Delay initialization slightly to ensure DOM is ready
    const timer = setTimeout(initializeMap, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  return (
    <div className={styles.mapWrapper}>
      {isLoading && <div className={styles.mapLoading}>Loading map...</div>}
      <div ref={mapRef} className={styles.mapContainer} />
    </div>
  );
};

// Export as dynamic component with no SSR
export default dynamic(() => Promise.resolve(DarkModeMap), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map component...</div>
});
