import fs from 'fs';
import path from 'path';

const subscriptionsFile = path.resolve(process.cwd(), 'subscriptions.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { subscription } = req.body;

  // Validate subscription object
  if (!subscription || !subscription.endpoint || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ message: 'Invalid subscription object' });
  }

  // Read existing subscriptions
  let subscriptions = [];
  if (fs.existsSync(subscriptionsFile)) {
    try {
      const data = fs.readFileSync(subscriptionsFile);
      subscriptions = JSON.parse(data);
    } catch (error) {
      console.error('Error parsing subscriptions file:', error);
    }
  }

  // Check if the subscription already exists
  const alreadySubscribed = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
  if (alreadySubscribed) {
    return res.status(200).json({ message: 'Already subscribed' });
  }

  // Add new subscription
  subscriptions.push(subscription);

  // Save subscriptions to file
  fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));

  console.log('Received subscription:', subscription);

  res.status(200).json({ message: 'Subscription received successfully' });
}

