// API endpoint to handle web push unsubscriptions (Supabase)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription data' });
    }

    // Create a unique identifier for this subscription
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);

    // Use Supabase client to remove subscription
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('subscription_id', subscriptionId);

    if (error) {
      console.error('Error removing push subscription:', error);
      return res.status(500).json({ 
        error: 'Failed to remove subscription',
        details: error.message 
      });
    }

    console.log('✅ Push subscription removed:', subscriptionId);

    res.status(200).json({ 
      success: true, 
      message: 'Subscription removed successfully',
      subscriptionId
    });

  } catch (error) {
    console.error('❌ Error removing push subscription:', error);
    res.status(500).json({ 
      error: 'Failed to remove subscription',
      details: error.message 
    });
  }
} 