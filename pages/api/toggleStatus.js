import fs from 'fs';
import path from 'path';
import webPush from '../../utils/webPush';

const statusFile = path.resolve(process.cwd(), 'status.txt');
const subscriptionsFile = path.resolve(process.cwd(), 'subscriptions.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { status } = req.body;

  if (status !== 'on' && status !== 'off') {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  // Write status to file
  fs.writeFileSync(statusFile, status);

  // Read existing subscriptions
  let subscriptions = [];
  if (fs.existsSync(subscriptionsFile)) {
    const data = fs.readFileSync(subscriptionsFile);
    subscriptions = JSON.parse(data);
  }

  // Prepare notification payload
  const title = status === 'on' ? 'We are open!' : 'We are closed!';
  const body = status === 'on' ? 'Come visit us now!' : 'Sorry, we are closed at the moment.';
  const payload = JSON.stringify({
    title,
    body,
    icon: '/default-icon.png',
    image: '/default-image.png',
    data: { url: '/' }
  });

  // Send notification to each subscription
  const sendNotificationPromises = subscriptions.map(subscription =>
    webPush.sendNotification(subscription, payload)
  );

  try {
    await Promise.all(sendNotificationPromises);
    res.status(200).json({ message: `Status set to ${status} and notifications sent successfully` });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
