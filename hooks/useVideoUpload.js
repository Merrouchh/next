import { useState, useCallback, useRef, useEffect } from 'react';

// Constants for upload optimization
const CHUNK_SIZE = 1024 * 1024 * 2; // 2MB chunks for better performance with network files
const SLOW_UPLOAD_THRESHOLD = 500; // 500ms to detect slow uploads

export function useVideoUpload() {
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const xhrRef = useRef(null);
  const timeoutRef = useRef(null);
  const performanceRef = useRef({
    startTime: 0,
    lastProgressTime: 0,
    uploadSpeed: 0
  });
  
  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (xhrRef.current) {
        try {
          xhrRef.current.abort();
        } catch (error) {
          console.warn('Error aborting XHR:', error);
        }
      }
    };
  }, []);
  
  // Function to detect if we should use chunked upload
  const shouldUseChunkedUpload = useCallback((file) => {
    // Use chunked upload for large files or if we detect slow network
    return file.size > 20 * 1024 * 1024 || isSlowNetwork;
  }, [isSlowNetwork]);
  
  // Regular direct upload
  const performDirectUpload = useCallback(async (file, uploadUrl, uid) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      
      performanceRef.current.startTime = performance.now();
      performanceRef.current.lastProgressTime = performance.now();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = performance.now();
          const timeDiff = now - performanceRef.current.lastProgressTime;
          
          // Calculate upload speed every second
          if (timeDiff > 1000) {
            const bytesUploaded = event.loaded - (performanceRef.current.lastBytes || 0);
            const uploadSpeed = (bytesUploaded / timeDiff) * 1000; // bytes per second
            
            performanceRef.current.uploadSpeed = uploadSpeed;
            performanceRef.current.lastBytes = event.loaded;
            performanceRef.current.lastProgressTime = now;
            
            // Detect slow network
            if (uploadSpeed < 50000) { // Less than 50KB/s
              setIsSlowNetwork(true);
            }
          }
          
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(Math.round(progress));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(uid);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        reject(new Error('Upload cancelled'));
      };
      
      xhr.open('POST', uploadUrl, true);
      
      // Add timeout handler
      xhr.timeout = 5 * 60 * 1000; // 5 minute timeout
      xhr.ontimeout = () => {
        reject(new Error('Upload request timed out'));
      };
      
      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  }, []);
  
  const uploadFile = useCallback(async (file, metadata) => {
    try {
      setUploadStatus('preparing');
      setUploadError(null);
      
      // Set a timeout to prevent hanging in the preparing state
      timeoutRef.current = setTimeout(() => {
        if (uploadStatus === 'preparing') {
          setUploadStatus('error');
          setUploadError('Timed out while preparing upload');
          throw new Error('Upload preparation timeout');
        }
      }, 30000); // 30 second timeout
      
      // Get upload URL from Cloudflare
      const response = await fetch('/api/copy-to-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to get upload URL: ${response.status}`);
      }

      const { uploadUrl, uid } = await response.json();
      
      // Clear the preparation timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Upload directly to Cloudflare
      setUploadStatus('uploading');
      
      // Set a new timeout for the upload process
      timeoutRef.current = setTimeout(() => {
        if (uploadStatus === 'uploading' && xhrRef.current) {
          xhrRef.current.abort();
          setUploadStatus('error');
          setUploadError('Upload timed out');
          throw new Error('Upload timeout');
        }
      }, 5 * 60 * 1000); // 5 minute timeout
      
      // Perform the upload
      await performDirectUpload(file, uploadUrl, uid);

      // Clear the upload timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      setUploadStatus('processing');
      return uid;

    } catch (error) {
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      console.error('Upload error:', error);
      setUploadStatus(error.message === 'Upload cancelled' ? 'cancelled' : 'error');
      setUploadError(error.message);
      throw error;
    }
  }, [uploadStatus, performDirectUpload]);

  const cancelUpload = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setUploadStatus('cancelled');
      setUploadProgress(0);
    }
  }, []);

  const resetForm = useCallback(() => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
    setIsSlowNetwork(false);
    xhrRef.current = null;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Reset performance metrics
    performanceRef.current = {
      startTime: 0,
      lastProgressTime: 0,
      uploadSpeed: 0
    };
  }, []);

  return {
    uploadStatus,
    uploadProgress,
    uploadError,
    isSlowNetwork,
    uploadFile,
    cancelUpload,
    resetForm
  };
} 