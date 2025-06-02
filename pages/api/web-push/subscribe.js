// API endpoint to handle web push subscriptions (Supabase)
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription } = req.body;
    console.log('🔍 Received subscription request:', {
      hasSubscription: !!subscription,
      endpoint: subscription?.endpoint?.substring(0, 50) + '...',
      hasKeys: !!subscription?.keys,
      hasP256dh: !!subscription?.keys?.p256dh,
      hasAuth: !!subscription?.keys?.auth
    });

    if (!subscription || !subscription.endpoint) {
      console.error('❌ Invalid subscription data received:', subscription);
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
    
    // Extract additional info - handle multiple IPs from proxies/CDNs
    const forwardedFor = req.headers['x-forwarded-for'];
    let userIp = 'unknown';
    
    if (forwardedFor) {
      // Take the first IP address from the comma-separated list
      userIp = forwardedFor.split(',')[0].trim();
    } else if (req.connection.remoteAddress) {
      userIp = req.connection.remoteAddress;
    }
    
    // Validate IP format for PostgreSQL INET type
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (!ipv4Regex.test(userIp) && !ipv6Regex.test(userIp)) {
      userIp = null; // Set to null if invalid format
    }
    
    const userAgent = req.headers['user-agent'] || '';
    
    // Create a unique identifier for this subscription
    const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);

    // Use Supabase client with SERVICE ROLE KEY (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('🔍 Attempting to save subscription with:', {
      subscriptionId,
      userId,
      endpoint: subscription.endpoint?.substring(0, 50) + '...',
      hasP256dh: !!subscription.keys?.p256dh,
      hasAuth: !!subscription.keys?.auth,
      userIp,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    // First, try to check if table exists and is accessible
    try {
      const { data: testQuery, error: testError, count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true });
      
      console.log('🔍 Table accessibility test:', {
        success: !testError,
        error: testError?.message,
        count: count
      });
      
      if (testError) {
        console.error('❌ Table access test failed:', testError);
        return res.status(500).json({ 
          error: 'Database table access failed',
          details: testError.message,
          code: testError.code,
          hint: 'Check if push_subscriptions table exists and RLS policies are correct'
        });
      }
    } catch (tableError) {
      console.error('❌ Table access test exception:', tableError);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: tableError.message,
        type: tableError.name
      });
    }

    // Now try to save the subscription
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
      console.error('❌ Detailed error saving push subscription:', {
        error: error,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        subscriptionData: {
          subscription_id: subscriptionId,
          user_id: userId,
          endpoint: subscription.endpoint?.substring(0, 50) + '...',
          has_p256dh: !!subscription.keys?.p256dh,
          has_auth: !!subscription.keys?.auth
        }
      });
      return res.status(500).json({ 
        error: 'Failed to save subscription',
        details: error.message,
        code: error.code,
        hint: error.hint,
        subscriptionId
      });
    }

    console.log('✅ Push subscription saved successfully:', {
      subscriptionId,
      userId,
      dataId: data?.id
    });

    res.status(200).json({ 
      success: true, 
      message: 'Subscription saved successfully',
      subscriptionId,
      userId: userId,
      id: data?.id
    });

  } catch (error) {
    console.error('❌ Fatal error in subscribe endpoint:', {
      error: error,
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Failed to save subscription',
      details: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 