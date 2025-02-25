import React from 'react';
import { useRouter } from 'next/router';
import { MdCloudUpload } from 'react-icons/md';
import styles from '../../styles/Profile.module.css';

const UploadButton = ({ isFixed = false }) => {
  const router = useRouter();

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