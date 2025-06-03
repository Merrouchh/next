// Client-side Web Push Notification utilities

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get authentication headers with user token
 */
async function getAuthHeaders() {
  let headers = {
    'Content-Type': 'application/json',
  };
  
  // Add auth token if available
  if (typeof window !== 'undefined' && window.supabase) {
    try {
      const { data: { session } } = await window.supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.log('Could not get auth session for web push');
    }
  }
  
  return headers;
}

/**
 * Subscribe user to web push notifications
 */
export const subscribeUserToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('❌ Push messaging is not supported');
    return { success: false, error: 'Push messaging not supported' };
  }

  try {
    console.log('🔔 Subscribing to web push notifications...');
    
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('✅ Already subscribed to push notifications');
      
      // Still send to server in case it wasn't saved properly
      const headers = await getAuthHeaders();
      await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: existingSubscription.toJSON()
        })
      });
      
      return { success: true, subscription: existingSubscription };
    }

    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    });

    console.log('✅ Successfully subscribed to push notifications');
    
    // Send subscription to server
    const headers = await getAuthHeaders();
    const response = await fetch('/api/web-push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: subscription.toJSON()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription on server');
    }

    console.log('✅ Subscription saved on server');
    return { success: true, subscription };

  } catch (error) {
    console.error('❌ Failed to subscribe to push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe from web push notifications
 */
export const unsubscribeFromPush = async () => {
  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'Service Worker not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log('ℹ️ Not subscribed to push notifications');
      return { success: true };
    }

    // Unsubscribe from push manager
    const unsubscribed = await subscription.unsubscribe();
    
    if (unsubscribed) {
      // Remove from server
      const headers = await getAuthHeaders();
      await fetch('/api/web-push/unsubscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      console.log('✅ Successfully unsubscribed from push notifications');
      return { success: true };
    }

    return { success: false, error: 'Failed to unsubscribe' };

  } catch (error) {
    console.error('❌ Failed to unsubscribe from push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user is subscribed to push notifications
 */
export const isPushSubscribed = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
};

/**
 * Get current push subscription
 */
export const getPushSubscription = async () => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting push subscription:', error);
    return null;
  }
};

/**
 * Test sending a push notification
 */
export const testPushNotification = async () => {
  try {
    const response = await fetch('/api/web-push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Test push notification sent');
      return { success: true };
    } else {
      console.error('❌ Failed to send test push:', data.error);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error('❌ Test push error:', error);
    return { success: false, error: error.message };
  }
}; 