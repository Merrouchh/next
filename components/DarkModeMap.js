import { useEffect } from 'react';
import L from 'leaflet'; // Import Leaflet for map handling
import 'leaflet/dist/leaflet.css'; // Make sure Leaflet CSS is imported
import styles from './DarkModeMap.module.css'; // Your CSS module for custom styles

const DarkModeMap = () => {
  useEffect(() => {
    // Initialize the map only if it is not already initialized
    if (document.getElementById('map')._leaflet_id) return; // Check if map is already initialized

    // Initialize the map
    const map = L.map('map', {
      center: [35.768685, -5.810158], // Center on the target coordinates
      zoom: 12, // Appropriate zoom level
      zoomControl: false, // Disable zoom controls
      preferCanvas: true, // To improve performance on canvas
      dragging: false, // Disable dragging
      scrollWheelZoom: false, // Disable scroll wheel zoom
      doubleClickZoom: false, // Disable double click zoom
      boxZoom: false, // Disable box zoom
      keyboard: false, // Disable keyboard navigation
      touchZoom: false, // Disable pinch-to-zoom
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

    // Add a marker with the custom icon at the specified coordinates
    const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

    // Add a popup to the marker
    marker.bindPopup('<b>Merrouch Gaming</b><br>Click to Navigate').openPopup();

    // Define the navigation URL using your provided Google Maps link
    const googleMapsNavigationURL =
      'https://www.google.com/maps/dir//Cyber+Gaming+Merrouch,+Merrouch+Gaming,+RDC,+Avenue+Abi+Elhassan+Chadili,+rue+1+R%C3%A9sidence+Rania+1,+Tangier+90060/@35.7578609,-5.8644455,12z/data=!4m17!1m7!3m6!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!2sCyber+Gaming+Merrouch!8m2!3d35.7686846!4d-5.8101584!16s%2Fg%2F11s_sxbgx1!4m8!1m0!1m5!1m1!1s0xd0b8119c440343d:0x93cde0af29aeb9c5!2m2!1d-5.8101584!2d35.7686846!3e2?entry=ttu&g_ep=EgoyMDI0MTExOS4yIKXMDSoASAFQAw%3D%3D';

    // Add an event listener for when the marker is clicked
    marker.on('click', () => {
      // Open the navigation link in the default browser (Google Maps)
      window.open(googleMapsNavigationURL, '_blank');
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
