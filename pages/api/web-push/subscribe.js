// API endpoint to handle web push subscriptions (Supabase)
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

    // Get user ID from authentication
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (user && !error) {
          userId = user.id;
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
      }
    }
    
    // Extract additional info
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    
    // Create a unique identifier for this subscription
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);

    // Use Supabase client to save subscription
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        subscription_id: subscriptionId,
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys?.p256dh || '',
        auth_key: subscription.keys?.auth || '',
        user_ip: userIp,
        user_agent: userAgent,
        is_active: true
      }, {
        onConflict: 'subscription_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving push subscription:', error);
      return res.status(500).json({ 
        error: 'Failed to save subscription',
        details: error.message 
      });
    }

    console.log('✅ Push subscription saved:', subscriptionId);

    res.status(200).json({ 
      success: true, 
      message: 'Subscription saved successfully',
      subscriptionId,
      userId: userId,
      id: data?.id
    });

  } catch (error) {
    console.error('❌ Error saving push subscription:', error);
    res.status(500).json({ 
      error: 'Failed to save subscription',
      details: error.message 
    });
  }
} 