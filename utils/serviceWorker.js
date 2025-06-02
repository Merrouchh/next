// Service Worker registration and notification utilities

let serviceWorkerRegistration = null;
let lastNotificationTimes = new Map(); // Track by notification type
const NOTIFICATION_COOLDOWN = 1000; // 1 second between same-type notifications

/**
 * Register the service worker
 */
export const registerServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  try {
    console.log('🔧 Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
    
    serviceWorkerRegistration = registration;
    
    console.log('✅ Service Worker registered successfully:', registration.scope);
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker is ready and active!');
    
    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('🔄 New Service Worker available. Refresh to update.');
          }
        });
      }
    });
    
    return registration;
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Send a message to the service worker
 */
export const sendMessageToServiceWorker = (message) => {
  if (serviceWorkerRegistration && serviceWorkerRegistration.active) {
    serviceWorkerRegistration.active.postMessage(message);
  }
};

/**
 * Show notification through service worker (more reliable)
 */
export const showServiceWorkerNotification = async (title, options = {}) => {
  try {
    // Intelligent rate limiting by notification type
    const notificationType = options.tag || 'default';
    const now = Date.now();
    const lastTime = lastNotificationTimes.get(notificationType) || 0;
    
    if (now - lastTime < NOTIFICATION_COOLDOWN) {
      console.log(`🔔 Notification rate limited for type ${notificationType}, skipping...`);
      return false;
    }
    lastNotificationTimes.set(notificationType, now);

    // Check if we have notification permission first
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }

    // Wait for service worker to be ready (this is the key fix!)
    const registration = await navigator.serviceWorker.ready;
    
    if (!registration || !registration.active) {
      console.log('Service Worker not ready or active, falling back to regular notification');
      return showRegularNotification(title, options);
    }

    // Additional check for showNotification support
    if (typeof registration.showNotification !== 'function') {
      console.log('Service Worker showNotification not supported, falling back');
      return showRegularNotification(title, options);
    }

    console.log('🔔 Service Worker is ready, showing notification...');
    
    // Use service worker to show notification (more reliable)
    await registration.showNotification(title, {
      body: options.body || '',
      icon: options.icon || '/logo.png',
      badge: options.badge || '/favicon.ico',
      tag: options.tag || 'default',
      data: options.data || {},
      requireInteraction: options.requireInteraction || false,
      actions: options.actions || [],
      vibrate: options.vibrate || [200, 100, 200],
      ...options
    });
    
    console.log('✅ Service Worker notification sent:', title);
    return true;
    
  } catch (error) {
    console.error('❌ Service Worker notification failed:', error);
    // Fallback to regular notification
    return showRegularNotification(title, options);
  }
};

/**
 * Regular notification fallback
 */
export const showRegularNotification = (title, options = {}) => {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.log('Regular notifications not available');
      return false;
    }
    
    new Notification(title, {
      body: options.body || '',
      icon: options.icon || '/logo.png',
      tag: options.tag || 'default',
      ...options
    });
    
    console.log('✅ Regular notification sent:', title);
    return true;
    
  } catch (error) {
    console.error('❌ Regular notification failed:', error);
    return false;
  }
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'denied';
  }
  
  try {
    const permission = await Notification.requestPermission();
    console.log('🔔 Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * Check if notifications are supported and enabled
 */
export const areNotificationsEnabled = () => {
  const hasNotificationAPI = 'Notification' in window;
  const hasPermission = hasNotificationAPI && Notification.permission === 'granted';
  const hasServiceWorker = 'serviceWorker' in navigator;
  
  return {
    supported: hasNotificationAPI,
    permission: hasNotificationAPI ? Notification.permission : 'denied',
    enabled: hasPermission,
    serviceWorkerSupported: hasServiceWorker,
    serviceWorkerRegistered: !!serviceWorkerRegistration
  };
};

/**
 * Simple notification function that works immediately (fallback for when SW isn't ready)
 */
export const showQuickNotification = (title, body) => {
  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/logo.png',
        badge: '/favicon.ico'
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Quick notification failed:', error);
    return false;
  }
};

/**
 * Reset notification rate limiting (useful when user rejoins queue)
 */
export const resetNotificationRateLimit = () => {
  lastNotificationTimes.clear();
  console.log('🔔 Notification rate limits reset');
};

/**
 * Get service worker registration
 */
export const getServiceWorkerRegistration = () => serviceWorkerRegistration; 