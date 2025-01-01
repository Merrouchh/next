import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from '../styles/DarkModeMap.module.css';

const DarkModeMap = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!mapRef.current || isInitialized.current) return;

    // Set initialization flag
    isInitialized.current = true;

    const initMap = () => {
      try {
        mapInstance.current = L.map(mapRef.current, {
          center: [35.768685, -5.810158],
          zoom: 16,
          dragging: false, // Disable dragging
          scrollWheelZoom: false, // Disable scroll wheel zoom
          doubleClickZoom: false, // Disable double click zoom
          touchZoom: false, // Disable touch zoom
          zoomControl: false, // Disable zoom control
          attributionControl: false, // Disable attribution control
        });

        // Add dark theme tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapInstance.current);

        // Create custom logo marker
        const customIcon = L.divIcon({
          className: styles.markerIcon,
          html: `
            <div class="${styles.markerContainer}">
              <a href="https://www.google.com/maps/place/Cyber+Gaming+Merrouch/@35.7717735,-5.8325747,7380m/data=!3m1!1e3!4m6!3m5!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1?entry=ttu&g_ep=EgoyMDI0MTIxMS4wIKXMDSoASAFQAw%3D%3D" target="_blank" class="${styles.tooltip}">Click Me</a>
              <img src="/logomobile.png" class="${styles.markerLogo}" alt="Merrouch Gaming" />
              <div class="${styles.markerRing}"></div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25],
        });

        // Add marker with Google Maps link
        L.marker([35.768685, -5.810158], {
          icon: customIcon,
        }).addTo(mapInstance.current);

        // Force resize
        mapInstance.current.invalidateSize();
      } catch (error) {
        console.error('Map initialization error:', error);
      }
    };

    // Initialize map with delay
    setTimeout(initMap, 100);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        isInitialized.current = false;
      }
    };
  }, []);

  return <div ref={mapRef} className={styles.mapContainer} />;
};

export default DarkModeMap;
