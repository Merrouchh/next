import { useState, useRef } from 'react';
import { FaExternalLinkAlt, FaUpload } from 'react-icons/fa';
import { submitReviewScreenshot } from '../../lib/achievements/achievementService';
import styles from '../../styles/Awards.module.css';
import toast from 'react-hot-toast';

/**
 * Component for uploading review screenshots to claim the review achievement
 */
const ReviewUploader = ({ supabase, userId, onSuccess }) => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File is too large. Maximum size is 5MB.');
        return;
      }
      
      setUploadedFile(file);
      toast.success(`File selected: ${file.name}`);
    }
  };
  
  const openGoogleReview = () => {
    window.open('https://g.page/r/CcW5rimv4M2TEAE/review', '_blank');
  };
  
  const handleUploadScreenshot = async () => {
    if (!uploadedFile || !userId) {
      if (!uploadedFile) {
        toast.error("Please select a file first");
      }
      if (!userId) {
        toast.error("You must be logged in to upload screenshots");
      }
      return;
    }
    
    setIsUploading(true);
    
    try {
      const result = await submitReviewScreenshot(
        supabase, 
        userId, 
        uploadedFile, 
        setUploadProgress
      );
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      toast.success('Screenshot uploaded successfully! Your review will be verified soon.', {
        duration: 5000
      });
      
      // Reset the file input
      setUploadedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Notify parent component of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      toast.error(`Failed to upload screenshot: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className={styles.reviewButtonsContainer}>
      <button 
        className={`${styles.reviewButton} ${styles.googleButton}`}
        onClick={openGoogleReview}
      >
        <FaExternalLinkAlt className={styles.buttonIcon} />
        <span>Leave a Review</span>
      </button>
      
      <input
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        id="achievement-screenshot-upload"
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      
      <label 
        htmlFor="achievement-screenshot-upload"
        className={`${styles.reviewButton} ${styles.uploadButton}`}
      >
        <FaUpload className={styles.buttonIcon} />
        <span>Upload Screenshot</span>
      </label>
      
      {uploadedFile && (
        <div className={styles.selectedFile}>
          <p>Selected: {uploadedFile.name}</p>
          <button 
            className={styles.submitButton}
            onClick={handleUploadScreenshot}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewUploader; 