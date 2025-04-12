import React from 'react';
import { useRouter } from 'next/router';
import { MdCloudUpload, MdBuildCircle, MdWarning } from 'react-icons/md';
import styles from '../../styles/Profile.module.css';
import MaintenanceOverlay from '../MaintenanceOverlay';

// Set to true to enable maintenance mode
const UPLOAD_MAINTENANCE_MODE = true;

const UploadButton = ({ isFixed = false }) => {
  const router = useRouter();

  if (UPLOAD_MAINTENANCE_MODE) {
    return (
      <div 
        className={`${styles.uploadButton} ${isFixed ? styles.fixedButton : styles.inlineButton} ${styles.maintenanceMode}`}
        onClick={() => router.push('/upload')}
      >
        <MdBuildCircle className={styles.maintenanceIcon} />
        <span>Under Maintenance</span>
        <div className={styles.maintenanceBadge}>
          <MdWarning size={16} />
        </div>
      </div>
    );
  }

  return (
    <button 
      onClick={() => router.push('/upload')}
      className={`${styles.uploadButton} ${isFixed ? styles.fixedButton : styles.inlineButton}`}
      aria-label="Upload new clip"
    >
      <MdCloudUpload className={styles.uploadIcon} />
      <span>{isFixed ? 'Upload Clip' : 'Upload New Clip'}</span>
    </button>
  );
};

export default UploadButton; 