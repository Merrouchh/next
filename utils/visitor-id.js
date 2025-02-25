import FingerprintJS from '@fingerprintjs/fingerprintjs'

let cachedVisitorId = new Map();

// Add cleanup function
export const cleanupVisitorIds = () => {
  cachedVisitorId.clear();
};

export const getVisitorId = async (userId = null) => {
  // Generate a session-specific component
  const getSessionComponent = () => {
    try {
      let sessionId = sessionStorage.getItem('sessionComponent');
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem('sessionComponent', sessionId);
      }
      return sessionId;
    } catch {
      return Date.now().toString(36);
    }
  };

  // If user is logged in, use their ID as part of the fingerprint
  const userComponent = userId ? `user_${userId}` : 'anon';
  
  // Check session-specific cache first
  const sessionKey = `${userComponent}_${getSessionComponent()}`;
  if (cachedVisitorId.has(sessionKey)) {
    return cachedVisitorId.get(sessionKey);
  }

  try {
    // Initialize FingerprintJS with enhanced options
    const fpPromise = FingerprintJS.load({
      monitoring: false,
      components: {
        screenResolution: true,
        colorDepth: true,
        platform: true,
        language: true,
        timezone: true,
        canvas: true,
        audio: true,
        fonts: true,
        // Add more browser-specific components
        webgl: true,
        plugins: true,
        touchSupport: true,
      }
    });

    const fp = await fpPromise;
    const result = await fp.get();

    // Combine multiple factors for a more unique identifier
    const deviceId = result.visitorId;
    const sessionComponent = getSessionComponent();
    const timeComponent = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Day-based

    // Create a composite ID that includes:
    // - User ID (if logged in)
    // - Device fingerprint
    // - Session component
    // - Time-based component
    const compositeId = [
      userComponent,
      `dev_${deviceId}`,
      `sess_${sessionComponent}`,
      `t_${timeComponent}`
    ].join('_');

    // Cache the ID
    cachedVisitorId.set(sessionKey, compositeId);

    // Clean up old cache entries periodically
    const cleanupOldEntries = () => {
      const now = Date.now();
      for (const [key, value] of cachedVisitorId.entries()) {
        if (now - value.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
          cachedVisitorId.delete(key);
        }
      }
    };

    // Run cleanup every hour
    setInterval(cleanupOldEntries, 60 * 60 * 1000);

    return compositeId;

  } catch (error) {
    console.error('Error generating visitor ID:', error);
    
    // Enhanced fallback with user-specific components
    const fallbackId = generateFallbackId(userId);
    return fallbackId;
  }
};

// Enhanced fallback ID generator
const generateFallbackId = (userId = null) => {
  const components = [
    userId || 'anon',
    window.navigator.userAgent,
    window.screen.height,
    window.screen.width,
    window.navigator.language,
    window.navigator.platform,
    new Date().getTimezoneOffset(),
    // Add session-specific component
    sessionStorage.getItem('sessionComponent') || Math.random().toString(36),
    // Add time-based component
    Math.floor(Date.now() / (1000 * 60 * 60 * 24))
  ];

  const idString = components.join('|');
  let hash = 0;
  
  for (let i = 0; i < idString.length; i++) {
    const char = idString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `fb_${userId || 'anon'}_${Math.abs(hash).toString(36)}`;
}; 