// Utility to conditionally load video-related scripts only when needed
let scriptsLoaded = false;
let scriptLoadingPromise = null;

export const loadVideoScripts = async () => {
  // Return early if scripts are already loaded
  if (scriptsLoaded) {
    return Promise.resolve();
  }

  // Return existing promise if already loading
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  // Create new loading promise
  scriptLoadingPromise = new Promise((resolve, reject) => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    // Load scripts dynamically only when needed
    const loadScript = (src) => {
      return new Promise((scriptResolve, scriptReject) => {
        // Check if script already exists
        if (document.querySelector(`script[src="${src}"]`)) {
          scriptResolve();
          return;
        }

        const script = document.createElement('script');
        script.type = 'module';
        script.src = src;
        // Add cache-friendly attributes
        script.setAttribute('data-cache-version', '1.0.0');
        script.crossOrigin = 'anonymous';
        // Add cache control hint
        script.setAttribute('data-cache-control', 'max-age=2592000');
        script.onload = () => scriptResolve();
        script.onerror = () => scriptReject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    // Load video-related scripts with optimized caching
    // Note: video.js already has built-in HLS support, so external scripts may not be needed
    const scriptsToLoad = [
      // Only load HLS script if specifically needed for advanced features
      // 'https://cdn.jsdelivr.net/npm/hls-video-element@1.2.0/+esm'
    ];

    Promise.all(scriptsToLoad.map(loadScript))
      .then(() => {
        scriptsLoaded = true;
        scriptLoadingPromise = null;
        resolve();
      })
      .catch((error) => {
        console.warn('Failed to load video scripts:', error);
        scriptLoadingPromise = null;
        // Don't reject - video.js can still work without these scripts
        resolve();
      });
  });

  return scriptLoadingPromise;
};

// Reset function for testing
export const resetVideoScripts = () => {
  scriptsLoaded = false;
  scriptLoadingPromise = null;
}; 