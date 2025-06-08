// Cache Manager - Automatic cache invalidation for deployments
(function() {
  'use strict';
  
  // Configuration
  const CACHE_VERSION_KEY = 'app_cache_version';
  const CHECK_INTERVAL = 30000; // Check every 30 seconds
  const VERSION_ENDPOINT = '/_next/static/build-version.txt';
  
  let isChecking = false;
  let currentVersion = null;
  
  // Get current version from meta tag or generate one
  function getCurrentVersion() {
    const buildMeta = document.querySelector('meta[name="build-version"]');
    if (buildMeta) {
      return buildMeta.getAttribute('content');
    }
    
    // Fallback: extract from script src
    const scripts = document.querySelectorAll('script[src*="_next/static"]');
    for (let script of scripts) {
      const match = script.src.match(/_next\/static\/([^\/]+)\//);
      if (match) {
        return match[1];
      }
    }
    
    return Date.now().toString();
  }
  
  // Check if new version is available
  async function checkForUpdates() {
    if (isChecking || !navigator.onLine) return;
    
    try {
      isChecking = true;
      
      // Try to fetch a version indicator
      const response = await fetch('/?v=' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      
      const newVersion = etag || lastModified || Date.now().toString();
      const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
      
      if (storedVersion && storedVersion !== newVersion) {
        console.log('🔄 New version detected, updating cache...');
        await invalidateCache();
        return true;
      }
      
      // Store current version
      localStorage.setItem(CACHE_VERSION_KEY, newVersion);
      return false;
      
    } catch (error) {
      console.debug('Cache check failed:', error.message);
      return false;
    } finally {
      isChecking = false;
    }
  }
  
  // Invalidate cache and reload
  async function invalidateCache() {
    try {
      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Clear local storage (except user preferences)
      const preserveKeys = ['theme', 'language', 'user_preferences'];
      const itemsToPreserve = {};
      
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) itemsToPreserve[key] = value;
      });
      
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore preserved items
      Object.entries(itemsToPreserve).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // Show update notification
      showUpdateNotification();
      
    } catch (error) {
      console.error('Cache invalidation failed:', error);
      // Force reload anyway
      window.location.reload(true);
    }
  }
  
  // Show update notification to user
  function showUpdateNotification() {
    // Create notification element
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #000;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">🚀</span>
          <div>
            <div style="font-weight: 600; margin-bottom: 5px;">Update Available!</div>
            <div style="font-size: 14px; opacity: 0.8;">Refreshing to latest version...</div>
          </div>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    // Auto reload after showing notification
    setTimeout(() => {
      window.location.reload(true);
    }, 2000);
  }
  
  // Initialize cache manager
  function initCacheManager() {
    // Initial version check
    currentVersion = getCurrentVersion();
    localStorage.setItem(CACHE_VERSION_KEY, currentVersion);
    
    // Periodic checks for updates
    setInterval(checkForUpdates, CHECK_INTERVAL);
    
    // Check when coming back online
    window.addEventListener('online', checkForUpdates);
    
    // Check when page becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        setTimeout(checkForUpdates, 1000);
      }
    });
    
    console.log('📦 Cache manager initialized, version:', currentVersion);
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCacheManager);
  } else {
    initCacheManager();
  }
  
})(); 