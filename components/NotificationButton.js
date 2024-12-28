import React from 'react';

const NotificationButton = () => {
  const subscribeToPushNotifications = async () => {
    try {
      console.log('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Notification permission denied.');
        return;
      }

      console.log('Registering service worker...');
      const registration = await navigator.serviceWorker.ready;
      console.log('Service worker registered:', registration);

      console.log('Subscribing to push notifications...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BI77cEBaJDS7BT_bpo8zt7jjIdZhXVmMr2881f2TNVIUo6irIsgqp9KZYXeAVggEvXN9nyIQBUupl1RLUPgs9EM'
      });
      console.log('Push subscription:', subscription);

      // Check if keys property exists
      if (subscription.keys) {
        const p256dh = subscription.keys.p256dh;
        const auth = subscription.keys.auth;
        console.log('p256dh:', p256dh);
        console.log('auth:', auth);
      } else {
        console.log('Subscription keys are not available.');
      }

      console.log('Sending subscription to server...');
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
      });

      console.log('Subscribed to push notifications');

      // Wait for 2 seconds and then send a test notification to all users
      setTimeout(async () => {
        console.log('Sending test notification to all users...');
        const response = await fetch('/api/sendNotificationToAll', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Test Notification',
            body: 'This is a test notification to all users.'
          })
        });
        if (response.ok) {
          console.log('Test notification sent to all users');
        } else {
          console.error('Error sending test notification to all users:', response.statusText);
        }
      }, 2000);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  return (
    <button onClick={subscribeToPushNotifications}>
      Enable Notifications
    </button>
  );
};

export default NotificationButton;
