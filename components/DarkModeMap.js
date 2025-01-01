import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import styles from '../styles/DarkModeMap.module.css';

const DarkModeMap = () => {
  const [Map, setMap] = useState(null);

  useEffect(() => {
    // Only import Leaflet on client side
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        import('react-leaflet').then(({ MapContainer, TileLayer, Marker, Popup }) => {
          const position = [35.759465, -5.833954];

          // Fix Leaflet default icon
          delete L.default.Icon.Default.prototype._getIconUrl;
          L.default.Icon.Default.mergeOptions({
            iconRetinaUrl: '/leaflet/marker-icon-2x.png',
            iconUrl: '/leaflet/marker-icon.png',
            shadowUrl: '/leaflet/marker-shadow.png',
          });

          const MapComponent = () => (
            <MapContainer 
              center={position} 
              zoom={16} 
              scrollWheelZoom={false}
              style={{ height: '400px', width: '100%', borderRadius: '12px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <Marker position={position}>
                <Popup>
                  Merrouch Gaming<br/>
                  Avenue Abi Elhassan Chadili, Tangier
                </Popup>
              </Marker>
            </MapContainer>
          );

          setMap(() => MapComponent);
        });
      });
    }
  }, []);

  return Map ? <Map /> : (
    <div style={{ 
      height: '400px', 
      width: '100%', 
      background: 'rgba(20, 20, 35, 0.8)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFD700'
    }}>
      Loading map...
    </div>
  );
};

export default DarkModeMap;
