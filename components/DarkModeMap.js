import { useEffect } from 'react';
import L from 'leaflet'; // Import Leaflet for map handling
import 'leaflet/dist/leaflet.css'; // Make sure Leaflet CSS is imported
import styles from './DarkModeMap.module.css'; // Your CSS module for custom styles

const DarkModeMap = () => {
  useEffect(() => {
    // Initialize the map only if it is not already initialized
    if (document.getElementById('map')._leaflet_id) return; // Check if map is already initialized

    // Initialize the map with the new coordinates
    const map = L.map('map', {
      center: [35.768685, -5.810158], // Updated coordinates
      zoom: 12, // Updated zoom level
      zoomControl: false, // Disable the zoom control
      preferCanvas: true, // To improve performance on canvas
    });

    // Add CartoDB Dark Matter Tile Layer for dark mode
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
      attribution: '', // Remove attribution
    }).addTo(map);

    // Remove the attribution control
    map.attributionControl.remove();

    // Create a custom icon with your logo from the public folder
    const customIcon = L.icon({
      iconUrl: '/logo.png', // Path to the logo in the public folder
      iconSize: [50, 50], // Adjust the size
      iconAnchor: [25, 50], // Adjust the anchor point
      popupAnchor: [0, -50], // Adjust popup position
    });

    // Coordinates for the marker
    const lat = 35.768685;
    const lon = -5.810158;

    // Add a marker with the custom icon at the new coordinates
    const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

    // Add a popup to the marker (optional)
    marker.bindPopup('<b>Merrouch Gaming</b><br>Click on the Icon').openPopup();

    // Define the navigation URL for Google Maps
    const googleMapsNavigationURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

    // Add an event listener for when the marker is clicked
    marker.on('click', () => {
      // Open the navigation link in the default browser (Google Maps)
      window.open(googleMapsNavigationURL, '_blank');
    });

    // Ensure the map size is updated on window resize
    window.addEventListener('resize', () => {
      map.invalidateSize();
    });

    // Cleanup on component unmount
    return () => {
      map.remove(); // Ensure the map is properly cleaned up on unmount
    };
  }, []); // Empty dependency array ensures this runs only once

  return (
    <div id="map" className={styles.mapContainer}></div> // Ensure the map container has a height
  );
};

export default DarkModeMap;
