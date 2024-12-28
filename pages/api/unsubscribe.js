import fs from 'fs';
import path from 'path';

const subscriptionsFile = path.resolve(process.cwd(), 'subscriptions.json');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { subscription } = req.body;

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

  // Remove the subscription
  subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);

  // Save updated subscriptions to file
  fs.writeFileSync(subscriptionsFile, JSON.stringify(subscriptions, null, 2));

  console.log('Removed subscription:', subscription);

  res.status(200).json({ message: 'Unsubscribed successfully' });
}
