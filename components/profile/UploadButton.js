import React, { useState } from 'react'
import Link from 'next/link'
import { MdAdd, MdInfoOutline } from 'react-icons/md'
import styles from '../../styles/Profile.module.css'

// Set to true if the upload feature is in maintenance
const UPLOAD_MAINTENANCE_MODE = false

export default function UploadButton({ isFixed = true, isCompact = false }) {
  const [showWarning, setShowWarning] = useState(false)

  if (UPLOAD_MAINTENANCE_MODE) {
    return (
      <div className={isCompact ? styles.compactUploadContainer : (isFixed ? styles.fixedUploadContainer : styles.uploadContainer)}>
        <button
          className={isCompact ? styles.compactUploadButton : styles.uploadButton}
          onClick={() => setShowWarning(true)}
        >
          <MdAdd /> {isCompact ? 'Upload Clip' : 'Upload New Clip'}
        </button>
        {showWarning && (
          <div className={styles.maintenanceWarning}>
            <MdInfoOutline size={20} />
            <p>Upload feature is currently under maintenance. Please try again later.</p>
            <button onClick={() => setShowWarning(false)}>Close</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={isCompact ? styles.compactUploadContainer : (isFixed ? styles.fixedUploadContainer : styles.uploadContainer)}>
      <Link href="/upload">
        <button className={isCompact ? styles.compactUploadButton : styles.uploadButton}>
          <MdAdd /> {isCompact ? 'Upload Clip' : 'Upload New Clip'}
        </button>
      </Link>
    </div>
  )
} 