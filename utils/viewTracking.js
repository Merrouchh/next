import FingerprintJS from '@fingerprintjs/fingerprintjs'

let fpPromise = null;

const getFingerprint = async () => {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  const fp = await fpPromise;
  const result = await fp.get();
  return result.visitorId;
};

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
};

export const trackView = async (clipId, viewerId = null, isAnonymous = false) => {
  console.log('trackView called with:', { clipId, viewerId, isAnonymous });
  
  if (!clipId || !viewerId) {
    console.error('Missing required parameters:', { clipId, viewerId });
    throw new Error('Missing required parameters: clipId and viewerId are required');
  }

  try {
    const fingerprint = await getFingerprint();
    const sessionId = getSessionId();

    console.log('Sending view tracking request:', {
      clipId,
      viewerId,
      isAnonymous,
      fingerprint: fingerprint.substring(0, 8) + '...',
      sessionId
    });

    const response = await fetch('/api/clips/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clipId,
        viewerId,
        isAnonymous,
        fingerprint,
        sessionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('View tracking request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('View tracking API error:', data.error);
      throw new Error(data.error);
    }

    console.log('View tracking successful:', data);
    return data.viewCount;
  } catch (error) {
    console.error('View tracking failed:', error);
    throw error;
  }
}; 