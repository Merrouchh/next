import { useState, useCallback, useRef } from 'react';

export function useVideoUpload() {
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const xhrRef = useRef(null);
  
  const uploadFile = useCallback(async (file, metadata) => {
    try {
      setUploadStatus('preparing');
      
      // Get upload URL from Cloudflare
      const response = await fetch('/api/copy-to-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, uid } = await response.json();
      
      // Upload directly to Cloudflare
      setUploadStatus('uploading');
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr; // Store xhr reference for cancellation
      
      await new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
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
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
      });

      setUploadStatus('processing');
      return uid;

    } catch (error) {
      setUploadStatus(error.message === 'Upload cancelled' ? 'cancelled' : 'error');
      throw error;
    }
  }, []);

  const cancelUpload = useCallback(async () => {
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
    xhrRef.current = null;
  }, []);

  return {
    uploadStatus,
    uploadProgress,
    uploadFile,
    cancelUpload,
    resetForm
  };
} 