// API endpoint for testing web push notifications (Supabase)
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@merrouchgaming.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get active push subscriptions from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(404).json({ 
        error: 'No active push subscriptions found',
        message: 'Subscribe to push notifications first'
      });
    }

    // Create notification payload
    const payload = JSON.stringify({
      title: '🧪 Test Notification',
      body: 'Web push notifications are working! You will get notified about queue updates even when the browser is closed.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'test-notification',
      data: {
        type: 'test',
        timestamp: Date.now(),
        url: '/avcomputers'
      },
      actions: [
        {
          action: 'open',
          title: 'View Queue',
          icon: '/icons/action-icon-open.png'
        }
      ]
    });

    // Send notifications to all active subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        };

        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Count successful and failed sends
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;

    console.log(`✅ Test notifications sent: ${successful} successful, ${failed} failed`);

    if (failed > 0) {
      console.log('Failed notifications:', results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason?.message || result.reason)
      );
    }

    res.status(200).json({
      success: true,
      message: `Test notifications sent to ${successful} subscribers`,
      stats: {
        total: subscriptions.length,
        successful,
        failed
      }
    });

  } catch (error) {
    console.error('❌ Error sending test push notifications:', error);
    res.status(500).json({
      error: 'Failed to send test notifications',
      details: error.message
    });
  }
} 