import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise = null;
// No caching - allow multiple views per session for fresh tracking

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

  // No caching - always track fresh views

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

    console.log('[View Tracking] Sending API request');
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

    // No caching - fresh tracking every time
    
    console.log('[View Tracking] Successfully recorded view, count:', data.viewCount);
    return data.viewCount;
  } catch (error) {
    console.error('[View Tracking] Failed:', error);
    
    // For unexpected errors, try the direct-view-insert API as fallback
    try {
      console.log('[View Tracking] Trying fallback method...');
      const fingerprint = await getFingerprint();
      const sessionId = getSessionId();
      
      const fallbackResponse = await fetch('/api/clips/direct-view-insert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clipId,
          viewerId,
          fingerprint,
          sessionId
        }),
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
      
          // No caching - fresh tracking every time
      
      console.log('[View Tracking] Fallback successful, count:', fallbackData.viewCount);
      return fallbackData.viewCount;
    } catch (fallbackError) {
      console.error('[View Tracking] Fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}; 