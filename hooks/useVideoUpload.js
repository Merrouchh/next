import { useState, useCallback, useRef, useEffect } from 'react';

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
    uploadSpeed: 0,
    lastReportedProgress: 0
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
  
  // Regular direct upload
  const performDirectUpload = useCallback(async (file, uploadUrl, uid) => {
    console.log(`[Frontend-Upload-1] Starting direct upload to Cloudflare for file: ${file.name}`);
    console.log(`[Frontend-Upload-1a] Upload URL: ${uploadUrl}`);
    console.log(`[Frontend-Upload-1b] Video UID: ${uid}`);
    
    // Server now handles status through @index.js
    console.log(`[Frontend-Upload-1c] Status will be handled by server monitoring`);
    
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
            
            console.log(`[Frontend-Upload-2] Upload progress: ${Math.round((event.loaded / event.total) * 100)}%, Speed: ${Math.round(uploadSpeed/1024)} KB/s`);
            
            // Detect slow network
            if (uploadSpeed < 50000) { // Less than 50KB/s
              setIsSlowNetwork(true);
              console.log(`[Frontend-Upload-2a] Slow network detected: ${Math.round(uploadSpeed/1024)} KB/s`);
            }
          }
          
          const progress = (event.loaded / event.total) * 100;
          const roundedProgress = Math.round(progress);
          setUploadProgress(roundedProgress);
          
          // Just log progress, don't make any API calls
          const progressThresholds = [10, 25, 50, 75, 90];
          const previousProgress = performanceRef.current.lastReportedProgress || 0;
          
          if (progressThresholds.some(threshold => 
              previousProgress < threshold && roundedProgress >= threshold)) {
            // Log the progress without making API calls
            console.log(`[Frontend-Upload-Progress] Progress at ${roundedProgress}%, speed: ${Math.round(performanceRef.current.uploadSpeed/1024)} KB/s`);
            performanceRef.current.lastReportedProgress = roundedProgress;
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log(`[Frontend-Upload-3] Upload completed successfully for ${uid}`);
          resolve(uid);
        } else {
          console.log(`[Frontend-Upload-Error] Upload failed with status ${xhr.status}: ${xhr.responseText}`);
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        console.log(`[Frontend-Upload-Error] Network error during upload for ${uid}`);
        reject(new Error('Network error during upload'));
      };

      xhr.onabort = () => {
        console.log(`[Frontend-Upload-Cancelled] Upload cancelled for ${uid}`);
        reject(new Error('Upload cancelled'));
      };
      
      xhr.open('POST', uploadUrl, true);
      
      // Add timeout handler
      xhr.timeout = 5 * 60 * 1000; // 5 minute timeout
      xhr.ontimeout = () => {
        console.log(`[Frontend-Upload-Timeout] Upload request timed out for ${uid}`);
        reject(new Error('Upload request timed out'));
      };
      
      const formData = new FormData();
      formData.append('file', file);
      console.log(`[Frontend-Upload-1c] Sending file to Cloudflare, size: ${(file.size/1024/1024).toFixed(2)} MB`);
      xhr.send(formData);
    });
  }, []);
  
  const uploadFile = useCallback(async (file, metadata) => {
    console.log(`[Frontend-Init-1] Starting upload process for ${file.name}`);
    console.log(`[Frontend-Init-1a] File details:`, { 
      size: `${(file.size/1024/1024).toFixed(2)} MB`,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });
    console.log(`[Frontend-Init-1b] Metadata:`, metadata);
    
    try {
      setUploadStatus('preparing');
      setUploadError(null);
      
      // Set a timeout to prevent hanging in the preparing state
      timeoutRef.current = setTimeout(() => {
        if (uploadStatus === 'preparing') {
          console.log(`[Frontend-Timeout] Upload preparation timed out`);
          setUploadStatus('error');
          setUploadError('Timed out while preparing upload');
          throw new Error('Upload preparation timeout');
        }
      }, 30000); // 30 second timeout
      
      // Get upload URL from Cloudflare
      console.log(`[Frontend-Init-2] Requesting upload URL from server via /api/copy-to-stream`);
      const response = await fetch('/api/copy-to-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });

      console.log(`[Frontend-Init-3] Server response status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(`[Frontend-Error] Failed to get upload URL:`, errorData);
        throw new Error(errorData.error || `Failed to get upload URL: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[Frontend-Init-4] Received upload URL and UID from server:`, { 
        uid: data.uid,
        success: data.success
      });
      const { uploadUrl, uid } = data;
      
      // Clear the preparation timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Force refresh the PendingUploadsBanner right after getting the upload URL
      // This ensures the banner shows the upload status before the actual file transfer begins
      if (typeof window.forceRefreshUploads === 'function') {
        console.log('%c[Frontend-Init-4a] Forcing banner refresh via global function', 'background: #222; color: #bada55; padding: 2px; border-radius: 2px;');
        window.forceRefreshUploads();
      } else {
        console.log('%c[Frontend-Init-4b] Forcing banner refresh via custom event', 'background: #222; color: #bada55; padding: 2px; border-radius: 2px;');
        window.dispatchEvent(new CustomEvent('refreshUploads'));
      }
      
      // Upload directly to Cloudflare
      setUploadStatus('uploading');
      console.log(`[Frontend-Init-5] Starting direct upload to Cloudflare`);
      
      // Set a new timeout for the upload process
      timeoutRef.current = setTimeout(() => {
        if (uploadStatus === 'uploading' && xhrRef.current) {
          console.log(`[Frontend-Timeout] Upload to Cloudflare timed out`);
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
      
      console.log(`[Frontend-Success] Upload completed, now in processing state. UID: ${uid}`);
      setUploadStatus('processing');
      return uid;

    } catch (error) {
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      console.log(`[Frontend-Error] Upload failed: ${error.message}`, error);
      setUploadStatus(error.message === 'Upload cancelled' ? 'cancelled' : 'error');
      setUploadError(error.message);
      throw error;
    }
  }, [uploadStatus, performDirectUpload]);

  // Add a direct upload method that can be used with pre-obtained URL and UID
  const uploadWithUrl = useCallback(async (file, uploadUrl, uid) => {
    console.log(`[Frontend-Direct-1] Starting direct upload for ${file.name} with pre-obtained URL`);
    console.log(`[Frontend-Direct-1a] Upload URL: ${uploadUrl}`);
    console.log(`[Frontend-Direct-1b] Video UID: ${uid}`);
    
    try {
      // Upload directly to Cloudflare
      setUploadStatus('uploading');
      console.log(`[Frontend-Direct-2] Starting direct upload to Cloudflare`);
      
      // Set a new timeout for the upload process
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        if (uploadStatus === 'uploading' && xhrRef.current) {
          console.log(`[Frontend-Timeout] Upload to Cloudflare timed out`);
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
      
      console.log(`[Frontend-Success] Upload completed, now in processing state. UID: ${uid}`);
      setUploadStatus('processing');
      return uid;

    } catch (error) {
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      console.log(`[Frontend-Error] Upload failed: ${error.message}`, error);
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
      uploadSpeed: 0,
      lastReportedProgress: 0
    };
  }, []);

  return {
    uploadStatus,
    uploadProgress,
    uploadError,
    isSlowNetwork,
    uploadFile,
    uploadWithUrl,
    cancelUpload,
    resetForm
  };
} 