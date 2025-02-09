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

export const trackView = async (clipId, userId = null) => {
  try {
    const fingerprint = await getFingerprint();
    const sessionId = getSessionId();

    const response = await fetch('/api/clips/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clipId,
        userId,
        fingerprint,
        sessionId,
      }),
    });

    const data = await response.json();
    return data.viewCount;
  } catch (error) {
    console.error('Failed to track view:', error);
    return null;
  }
}; 