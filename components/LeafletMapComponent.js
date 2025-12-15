import { useEffect, useRef } from 'react';

const LeafletMapComponent = ({ latitude, longitude, address }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const leafletRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    const initializeMap = async () => {
      try {
        // Load Leaflet dynamically
        if (!leafletRef.current) {
          const L = await import('leaflet');
          await import('leaflet/dist/leaflet.css');
          leafletRef.current = L.default;
        }

        const L = leafletRef.current;
        if (!L || !mapRef.current) return;

        // Clean up existing map
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        // Initialize map with dark theme
        mapInstance.current = L.map(mapRef.current, {
          center: [latitude, longitude],
          zoom: 17,
          dragging: true,
          scrollWheelZoom: false,
          doubleClickZoom: true,
          touchZoom: true,
          zoomControl: true,
          attributionControl: false,
        });

        // Use CartoDB dark theme tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(mapInstance.current);

        // Add custom marker with golden color
        const customIcon = L.divIcon({
          className: '',
          html: `<div style="
            width: 30px;
            height: 30px;
            background: #FFD700;
            border: 3px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 3px 14px rgba(0,0,0,0.4);
            position: relative;
          ">
            <div style="
              width: 10px;
              height: 10px;
              background: #000000;
              border-radius: 50%;
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(45deg);
            "></div>
          </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30]
        });

        // Main gaming center marker (golden)
        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(mapInstance.current);

        // Add popup with address
        if (address) {
          marker.bindPopup(`
            <div style="
              background: rgba(24, 25, 28, 0.95);
              color: #ffffff;
              padding: 0.75rem;
              border-radius: 8px;
              font-family: 'Inter', sans-serif;
              font-size: 0.9rem;
              border: 1px solid #FFD700;
            ">
              <strong style="color: #FFD700;">Merrouch Gaming</strong><br/>
              ${address}
            </div>
          `);
        }

        // Popular places nearby
        // To get exact coordinates from Google Maps: Right-click on the location > Click on coordinates to copy
        // Or open the share link and copy lat/lng from the URL (@lat,lng,zoom)
        const popularPlaces = [
          {
            name: 'Badr Mosque',
            // Google Maps link: https://share.google/rJ8F32g64XmYofOmA
            lat: 35.771389467367534,
            lng: -5.809111273525693,
            color: '#4A90E2', // Blue for mosque
            icon: '🕌'
          },
          {
            name: 'Clinic Salam',
            // Google Maps link: https://share.google/RcYQyrF3wP3vgSER8
            lat: 35.76998667363175,
            lng: -5.809641806418714,
            color: '#E24A4A', // Red for clinic
            icon: '🏥'
          }
        ];

        // Add markers for popular places
        popularPlaces.forEach(place => {
          const placeIcon = L.divIcon({
            className: '',
            html: `<div style="
              width: 28px;
              height: 28px;
              background: ${place.color};
              border: 3px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 3px 14px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              position: relative;
            ">${place.icon}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });

          const placeMarker = L.marker([place.lat, place.lng], { icon: placeIcon }).addTo(mapInstance.current);
          
          placeMarker.bindPopup(`
            <div style="
              background: rgba(24, 25, 28, 0.95);
              color: #ffffff;
              padding: 0.75rem;
              border-radius: 8px;
              font-family: 'Inter', sans-serif;
              font-size: 0.9rem;
              border: 1px solid ${place.color};
            ">
              <strong style="color: ${place.color}; font-size: 1rem;">${place.name}</strong>
            </div>
          `);
        });

        // Fit map to show all markers with padding
        const allLatLngs = [
          [latitude, longitude],
          ...popularPlaces.map(place => [place.lat, place.lng])
        ];
        
        const bounds = L.latLngBounds(allLatLngs);
        mapInstance.current.fitBounds(bounds, {
          padding: [30, 30],
          maxZoom: 17
        });

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [latitude, longitude, address]);

  return (
    <div 
      ref={mapRef} 
      style={{
        width: '100%',
        height: '300px',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#1a1f2c'
      }}
    />
  );
};

export default LeafletMapComponent;

