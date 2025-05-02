import { FaPlus, FaMinus, FaExpand, FaCompress, FaSearchPlus } from 'react-icons/fa';
import styles from '../../styles/Bracket.module.css';

const ZoomControls = ({ zoomLevel, onZoomIn, onZoomOut, onResetZoom, onToggleFullscreen, isFullscreen }) => {
  // Create a separate handler function to avoid passing the event object
  const handleZoomToFit = () => {
    onResetZoom(75);
  };

  return (
    <div className={styles.zoomControls}>
      <button 
        className={styles.zoomButton} 
        onClick={onZoomOut} 
        aria-label="Zoom out"
      >
        <FaMinus />
      </button>
      <div className={styles.zoomLevel}>{zoomLevel}%</div>
      <button 
        className={styles.zoomButton} 
        onClick={onZoomIn} 
        aria-label="Zoom in"
      >
        <FaPlus />
      </button>
      <button 
        className={styles.zoomButton} 
        onClick={onResetZoom} 
        aria-label="Reset zoom"
      >
        <FaExpand />
      </button>
      <button 
        className={styles.zoomButton} 
        onClick={handleZoomToFit} 
        aria-label="Zoom to fit"
      >
        <FaSearchPlus />
      </button>
      <button 
        className={styles.zoomButton} 
        onClick={onToggleFullscreen} 
        aria-label="Toggle fullscreen"
      >
        {isFullscreen ? <FaCompress /> : <FaExpand />}
      </button>
    </div>
  );
};

export default ZoomControls; 