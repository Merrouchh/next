import fs from 'fs';
import path from 'path';
import webPush from '../../utils/webPush';

const subscriptionsFile = path.resolve(process.cwd(), 'subscriptions.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { title, body, icon, url, image } = req.body;

  // Ensure the URL is valid and has the correct protocol
  const formattedUrl = url && !url.startsWith('http') ? `https://${url}` : url;

  // Log notification details
  console.log('Notification details:', { title, body, icon, image, formattedUrl });

  // Read subscriptions
  let subscriptions = [];
  if (fs.existsSync(subscriptionsFile)) {
    try {
      const data = fs.readFileSync(subscriptionsFile, 'utf-8');
      subscriptions = JSON.parse(data);
    } catch (error) {
      console.error('Error reading subscriptions file:', error);
      return res.status(500).json({ message: 'Error reading subscriptions file' });
    }
  }

  // Notification payload
  const payload = JSON.stringify({
    title: title || 'No title',
    body: body || 'No body',
    icon: icon || image || '/default-icon.png',
    image: image || '/default-image.png',
    data: { url: formattedUrl || 'https://example.com' }, // Fallback URL
  });

  console.log('Notification payload:', payload);

  // Send notifications
  const sendNotificationPromises = subscriptions.map(subscription =>
    webPush.sendNotification(subscription, payload).catch(error => {
      console.error('Error sending notification to subscription:', subscription, error);
    })
  );

  try {
    await Promise.all(sendNotificationPromises);
    res.status(200).json({ message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
