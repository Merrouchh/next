// Production debug endpoint for web push notifications
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const vapidConfig = {
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'SET' : 'NOT_SET',
      privateKey: process.env.VAPID_PRIVATE_KEY ? 'SET' : 'NOT_SET',
      email: process.env.VAPID_EMAIL || 'NOT_SET',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET'
    };

    // Check if keys have proper format
    let keyValidation = {};
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      keyValidation.publicKeyLength = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length;
      keyValidation.publicKeyValid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length > 60;
    }
    if (process.env.VAPID_PRIVATE_KEY) {
      keyValidation.privateKeyLength = process.env.VAPID_PRIVATE_KEY.length;
      keyValidation.privateKeyValid = process.env.VAPID_PRIVATE_KEY.length > 40;
    }

    // Test Supabase connection
    let supabaseTest = {};
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true });

              if (error) {
          supabaseTest = { success: false, error: error.message };
        } else {
          supabaseTest = { success: true, totalSubscriptions: count || 0 };
        }
    } catch (error) {
      supabaseTest = { success: false, error: error.message };
    }

    // Check request headers for debugging
    const requestInfo = {
      host: req.headers.host,
      userAgent: req.headers['user-agent'],
      protocol: req.headers['x-forwarded-proto'] || 'http',
      isHttps: req.headers['x-forwarded-proto'] === 'https' || req.connection.encrypted
    };

    res.status(200).json({
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      vapidConfig,
      keyValidation,
      supabaseTest,
      requestInfo,
      recommendations: [
        !vapidConfig.publicKey || !vapidConfig.privateKey ? 'Generate and set VAPID keys' : null,
        !requestInfo.isHttps ? 'Web Push requires HTTPS in production' : null,
        !supabaseTest.success ? 'Check Supabase connection and permissions' : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('❌ Production debug error:', error);
    res.status(500).json({
      error: 'Debug endpoint failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 