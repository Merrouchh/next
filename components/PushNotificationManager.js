// Component to handle push notification subscription migration
import { useEffect, useRef } from 'react';

const PushNotificationManager = () => {
  const migrationHandledRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return;
    }

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

    // Check for existing service worker and migration status
    navigator.serviceWorker.ready.then(checkMigrationStatus);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  const handleServiceWorkerMessage = async (event) => {
    const { data } = event;
    
    if (data.type === 'SERVICE_WORKER_UPDATED') {
      console.log(`🔄 Service Worker updated to v${data.version}`);
      
      if (data.needsPushMigration && !migrationHandledRef.current) {
        console.log('🔄 Push subscription migration needed');
        migrationHandledRef.current = true;
        await handlePushSubscriptionMigration();
      }
    }
    
    if (data.type === 'PUSH_SUBSCRIPTION_MIGRATION_NEEDED' && !migrationHandledRef.current) {
      console.log('🔄 Push subscription migration requested by service worker');
      migrationHandledRef.current = true;
      await handlePushSubscriptionMigration();
    }
  };

  const checkMigrationStatus = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if migration is needed
      const channel = new MessageChannel();
      
      const migrationStatus = await new Promise((resolve) => {
        channel.port1.onmessage = (event) => {
          resolve(event.data);
        };
        
        registration.active.postMessage(
          { type: 'GET_MIGRATION_STATUS' },
          [channel.port2]
        );
        
        // Timeout after 3 seconds
        setTimeout(() => resolve({ needsMigration: false }), 3000);
      });
      
      if (migrationStatus.needsMigration && !migrationHandledRef.current) {
        console.log('🔄 Migration needed on startup');
        migrationHandledRef.current = true;
        await handlePushSubscriptionMigration();
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  };

  const handlePushSubscriptionMigration = async () => {
    try {
      console.log('🔄 Starting push subscription migration...');
      
      // Show user notification about updating notifications
      showMigrationNotification();
      
      // Wait a moment for user to see the notification
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Re-subscribe to push notifications
      await subscribeToNotifications();
      
      // Notify service worker that migration was successful
      const registration = await navigator.serviceWorker.ready;
      registration.active.postMessage({ type: 'PUSH_SUBSCRIPTION_SUCCESS' });
      
      console.log('✅ Push subscription migration completed');
      
      // Show success message
      showMigrationSuccessNotification();
      
    } catch (error) {
      console.error('❌ Push subscription migration failed:', error);
      showMigrationErrorNotification(error.message);
    }
  };

  const subscribeToNotifications = async () => {
    try {
      // Get permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Already subscribed to notifications');
        return existingSubscription;
      }

      // Subscribe with new VAPID key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });

      // Save subscription to server
      const response = await fetch('/api/web-push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server error: ${errorData.details || errorData.error}`);
      }

      const result = await response.json();
      console.log('✅ Push subscription saved:', result.subscriptionId);
      
      return subscription;
      
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  };

  const showMigrationNotification = () => {
    // Create a subtle notification div
    const notification = document.createElement('div');
    notification.id = 'push-migration-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4f46e5;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      transition: opacity 0.3s ease;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px;">🔄</div>
        <div>Updating notifications...</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  };

  const showMigrationSuccessNotification = () => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      transition: opacity 0.3s ease;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px;">✅</div>
        <div>Notifications updated successfully!</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  };

  const showMigrationErrorNotification = (errorMessage) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      transition: opacity 0.3s ease;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px;">❌</div>
        <div>Notification update failed</div>
      </div>
      <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
        ${errorMessage}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };

  return null; // This component doesn't render anything
};

export default PushNotificationManager; 