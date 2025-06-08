// Utility to unregister all service workers
export const unregisterServiceWorkers = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      console.log('🗑️ Unregistering service worker:', registration.scope);
      await registration.unregister();
    }
    
    console.log('✅ All service workers unregistered successfully');
    
    // Clear any service worker caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        console.log('🗑️ Deleting cache:', cacheName);
        await caches.delete(cacheName);
      }
      console.log('✅ All caches cleared');
    }
    
  } catch (error) {
    console.error('❌ Failed to unregister service workers:', error);
  }
}; 