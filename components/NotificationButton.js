import React, { useEffect, useState } from 'react';

export default function NotificationButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const subscribeUser = () => {
    navigator.serviceWorker.ready.then(registration => {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BI77cEBaJDS7BT_bpo8zt7jjIdZhXVmMr2881f2TNVIUo6irIsgqp9KZYXeAVggEvXN9nyIQBUupl1RLUPgs9EM';
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }).then(subscription => {
        fetch('/api/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscription }),
        }).then(response => {
          if (response.ok) {
            console.log('User is subscribed');
            setIsSubscribed(true);
          } else {
            console.error('Failed to subscribe the user');
          }
        });
      }).catch(error => {
        console.error('Failed to subscribe the user:', error);
      });
    });
  };

  const unsubscribeUser = () => {
    navigator.serviceWorker.ready.then(registration => {
      registration.pushManager.getSubscription().then(subscription => {
        if (subscription) {
          subscription.unsubscribe().then(() => {
            fetch('/api/unsubscribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ subscription }),
            }).then(response => {
              if (response.ok) {
                console.log('User is unsubscribed');
                setIsSubscribed(false);
              } else {
                console.error('Failed to unsubscribe the user');
              }
            });
          }).catch(error => {
            console.error('Failed to unsubscribe the user:', error);
          });
        }
      });
    });
  };

  return (
    <div>
      {isSubscribed ? (
        <button onClick={unsubscribeUser}>
          Disable Notifications
        </button>
      ) : (
        <button onClick={subscribeUser}>
          Enable Notifications
        </button>
      )}
    </div>
  );
}

// Utility function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
