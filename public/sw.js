self.addEventListener('push', function(event) {
  console.log('Push event received:', event); // Debug log
  const data = event.data ? JSON.parse(event.data.text()) : {};

  const options = {
    body: data.body,
    icon: data.icon,
    image: data.image,
    data: { url: data.data.url }, // Pass the URL in the notification data
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification click event:', event); // Debug log
  event.notification.close();
  const notificationUrl = event.notification.data?.url;
  if (notificationUrl) {
    event.waitUntil(clients.openWindow(notificationUrl));
  }
});
