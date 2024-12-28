self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  if (!event.data) {
    console.log('Push event has no data.');
    return;
  }
  const data = event.data.json();
  console.log('Push data:', data);
  const options = {
    body: data.body,
    icon: data.image, // Use the image URL as the icon
    badge: '/badge.png', // Path to your app badge
    image: data.image, // Include the image in the notification
    data: { url: data.url || '/' } // Include the URL in the notification data
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click event:', event);
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url) // Use the URL from the notification data
  );
});

