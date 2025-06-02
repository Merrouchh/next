// API endpoint for monitoring queue changes and sending web push notifications
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@merrouchgaming.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Function to send web push notification
async function sendWebPushNotification(subscriptions, payload) {
  if (!subscriptions || subscriptions.length === 0) {
    return { successful: 0, failed: 0 };
  }

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

  const successful = results.filter(result => result.status === 'fulfilled').length;
  const failed = results.filter(result => result.status === 'rejected').length;

  return { successful, failed, results };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { computerType = 'av', userId, currentPosition, action } = req.body;

    if (!userId || currentPosition === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId and currentPosition' 
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get previous position for this user
    const { data: previousData } = await supabase
      .from('user_queue_positions')
      .select('position')
      .eq('user_id', userId)
      .single();

    const previousPosition = previousData?.position;
    
    // Update user position
    const { error: updateError } = await supabase
      .from('user_queue_positions')
      .upsert({
        user_id: userId,
        position: currentPosition,
        computer_type: computerType
      });

    if (updateError) {
      console.error('Error updating user position:', updateError);
      return res.status(500).json({ error: 'Failed to update position' });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
    }

    let notificationSent = false;
    let notificationStats = { successful: 0, failed: 0 };

    // Send notification based on position change
    if (subscriptions && subscriptions.length > 0) {
      let title = '';
      let body = '';
      let notificationTag = '';
      
      if (action === 'joined') {
        title = '🎮 Joined Queue';
        body = `You joined the ${computerType.toUpperCase()} computer queue at position ${currentPosition}`;
        notificationTag = 'queue-joined';
      } else if (action === 'left') {
        title = '👋 Left Queue';
        body = `You left the ${computerType.toUpperCase()} computer queue`;
        notificationTag = 'queue-left';
      } else if (previousPosition !== undefined && currentPosition !== previousPosition) {
        if (currentPosition < previousPosition) {
          title = '⬆️ Queue Position Improved';
          body = `Your position moved from ${previousPosition} to ${currentPosition} in the ${computerType.toUpperCase()} queue!`;
          notificationTag = 'queue-improved';
        } else if (currentPosition > previousPosition) {
          title = '⬇️ Queue Position Changed';
          body = `Your position moved from ${previousPosition} to ${currentPosition} in the ${computerType.toUpperCase()} queue`;
          notificationTag = 'queue-declined';
        }
      } else if (currentPosition === 1) {
        title = '🎉 Your Turn!';
        body = `You're next in line for the ${computerType.toUpperCase()} computer!`;
        notificationTag = 'queue-next';
      }

      if (title && body) {
        const payload = JSON.stringify({
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          tag: notificationTag,
          data: {
            type: 'queue-update',
            position: currentPosition,
            previousPosition,
            computerType,
            userId,
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

        notificationStats = await sendWebPushNotification(subscriptions, payload);
        notificationSent = true;

        console.log(`📱 Sent web push notification to user ${userId}: ${title}`);
        console.log(`   Stats: ${notificationStats.successful} successful, ${notificationStats.failed} failed`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Queue position updated',
      data: {
        userId,
        previousPosition,
        currentPosition,
        computerType,
        action,
        notificationSent,
        notificationStats,
        subscriptionsCount: subscriptions?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Error in queue monitor:', error);
    res.status(500).json({
      error: 'Failed to process queue update',
      details: error.message
    });
  }
} 