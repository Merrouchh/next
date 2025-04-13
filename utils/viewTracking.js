import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise = null;
// Add a local cache to prevent counting the same clip multiple times in a session
const viewedClips = new Set();
// Track pending view tracking requests when in fullscreen
const pendingFullscreenViews = new Map();

const getFingerprint = async () => {
  if (!fpPromise) {
    console.log('[View Tracking] Initializing fingerprint service');
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  console.log('[View Tracking] Generated fingerprint:', result.visitorId.substring(0, 8) + '...');
  return result.visitorId;
};

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('session_id', sessionId);
    console.log('[View Tracking] Created new session ID:', sessionId.substring(0, 8) + '...');
  }
  return sessionId;
};

// Check if browser is in fullscreen mode
const isInFullscreen = () => {
  if (typeof document === 'undefined') return false;
  
  return !!(
    document.fullscreenElement || 
    document.webkitFullscreenElement || 
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
};

// Listen for fullscreen change events to process any pending view tracking
if (typeof document !== 'undefined') {
  const fullscreenChangeHandler = () => {
    if (!isInFullscreen() && pendingFullscreenViews.size > 0) {
      console.log('[View Tracking] Exited fullscreen, processing pending view tracking');
      // Process all pending views now that we're out of fullscreen
      pendingFullscreenViews.forEach((requestData, key) => {
        sendViewTrackingRequest(requestData)
          .then(viewCount => {
            if (viewCount !== null) {
              console.log(`[View Tracking] Successfully processed delayed view for ${key}, count: ${viewCount}`);
              // Add to viewed clips cache after successful tracking
              viewedClips.add(key);
            }
          })
          .catch(error => {
            console.error('[View Tracking] Failed to process delayed view:', error);
          })
          .finally(() => {
            pendingFullscreenViews.delete(key);
          });
      });
    }
  };
  
  document.addEventListener('fullscreenchange', fullscreenChangeHandler);
  document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
  document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
}

// Helper function to send the actual API request
const sendViewTrackingRequest = async (requestData) => {
  console.log('[View Tracking] Sending API request');
  try {
    // Make the API call to track the view
    const response = await fetch('/api/clips/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    console.log('[View Tracking] API response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[View Tracking] API error:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('[View Tracking] API returned error:', data.error);
      throw new Error(data.error);
    }
    
    console.log('[View Tracking] Successfully recorded view, count:', data.viewCount);
    return data.viewCount;
  } catch (error) {
    console.error('[View Tracking] API request failed:', error);
    
    // For unexpected errors, try the direct-view-insert API as fallback
    try {
      console.log('[View Tracking] Trying fallback method...');
      
      const fallbackResponse = await fetch('/api/clips/direct-view-insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      console.log('[View Tracking] Fallback response status:', fallbackResponse.status);
      
      if (!fallbackResponse.ok) {
        throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
      }
      
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.error) {
        throw new Error(fallbackData.error);
      }
      
      if (fallbackData.duplicate) {
        console.log('[View Tracking] Fallback detected duplicate view');
        return null;
      }
      
      console.log('[View Tracking] Fallback successful, count:', fallbackData.viewCount);
      return fallbackData.viewCount;
    } catch (fallbackError) {
      console.error('[View Tracking] Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
};

export const trackView = async (clipId, viewerId = null, isAnonymous = false) => {
  console.log('[View Tracking] Function called with:', {
    clipId, 
    viewerId: viewerId?.substring(0, 8) + '...', 
    isAnonymous 
  });
  
  if (!clipId || !viewerId) {
    console.error('[View Tracking] Missing required parameters');
    throw new Error('Missing required parameters: clipId and viewerId are required');
  }

  // Check if this clip has already been viewed in this session
  const cacheKey = `${clipId}:${viewerId}`;
  if (viewedClips.has(cacheKey)) {
    console.log('[View Tracking] Already tracked in this session - skipping');
    return null; // Return null to indicate no new count was recorded
  }

  try {
    console.log('[View Tracking] Preparing request data');
    const fingerprint = await getFingerprint();
    const sessionId = getSessionId();

    const requestData = {
      clipId,
      viewerId,
      isAnonymous,
      fingerprint,
      sessionId,
    };

    // Check if we're in fullscreen mode - Brave specific fix
    if (isInFullscreen()) {
      console.log('[View Tracking] In fullscreen mode, delaying view tracking API call');
      // Store the view tracking request to process when exiting fullscreen
      pendingFullscreenViews.set(cacheKey, requestData);
      
      // Mark as tracked in this component's state, but don't add to viewedClips yet
      // This prevents multiple pending requests for the same clip
      return -1; // Special return value to indicate pending tracking
    }
    
    // If not in fullscreen, proceed with the API call
    const viewCount = await sendViewTrackingRequest(requestData);
    
    if (viewCount !== null) {
      // Add to cache after successful tracking
      viewedClips.add(cacheKey);
    }
    
    return viewCount;
  } catch (error) {
    console.error('[View Tracking] Failed:', error);
    throw error;
  }
}; 