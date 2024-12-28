import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import webPush from '../../utils/webPush';

const subscriptionsFile = path.resolve(process.cwd(), 'subscriptions.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { title, body, icon, url, image } = req.body;

  // Read existing subscriptions
  let subscriptions = [];
  if (fs.existsSync(subscriptionsFile)) {
    const data = fs.readFileSync(subscriptionsFile);
    subscriptions = JSON.parse(data);
  }

  // Send notification to all subscriptions
  const notificationPayload = JSON.stringify({
    title: title || 'No title',
    body: body || 'No body',
    icon: icon || image || '/default-icon.png', // Use icon or image as the icon
    image: image || '/default-image.png', // Include the image in the payload
    data: { url: url || '/' }, // Include the URL in the payload
    actions: [{ action: 'open_url', title: 'Read More' }]
  });

  subscriptions.forEach(subscription => {
    webpush.sendNotification(subscription, notificationPayload).catch(error => {
      console.error('Error sending notification:', error);
    });
  });

  res.status(200).json({ message: 'Notification sent successfully' });
}
