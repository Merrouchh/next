// Debug endpoint to identify production push subscription issues
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const results = {
    timestamp: new Date().toISOString(),
    environment: 'PRODUCTION',
    tests: {}
  };

  try {
    // Test 1: Environment variables check
    results.tests.environment_vars = {
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_vapid_public: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      has_vapid_private: !!process.env.VAPID_PRIVATE_KEY,
      supabase_url_preview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
      vapid_public_preview: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20) + '...'
    };

    // Test 2: Supabase connection
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Test database connection
      const { data: testQuery, error: testError, count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true });

      results.tests.supabase_connection = {
        success: !testError,
        error: testError?.message,
        count_result: count
      };

    } catch (error) {
      results.tests.supabase_connection = {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }

    // Test 3: Table structure check
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: tableCheck, error: tableError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .limit(1);

      results.tests.table_structure = {
        success: !tableError,
        error: tableError?.message,
        sample_columns: tableCheck?.[0] ? Object.keys(tableCheck[0]) : null
      };

    } catch (error) {
      results.tests.table_structure = {
        success: false,
        error: error.message
      };
    }

    // Test 4: Test subscription save
    if (req.method === 'POST' && req.body.test_subscription) {
      try {
        const testSubscription = {
          endpoint: 'https://test-endpoint.com/test',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        };

        const subscriptionId = 'test-' + Date.now();
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert({
            subscription_id: subscriptionId,
            user_id: null,
            endpoint: testSubscription.endpoint,
            p256dh_key: testSubscription.keys.p256dh,
            auth_key: testSubscription.keys.auth,
            user_ip: null,
            user_agent: 'test-agent',
            is_active: true
          }, {
            onConflict: 'subscription_id'
          })
          .select()
          .single();

        results.tests.test_subscription_save = {
          success: !error,
          error: error?.message,
          data: data,
          subscription_id: subscriptionId
        };

        // Clean up test data
        if (!error) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription_id', subscriptionId);
        }

      } catch (error) {
        results.tests.test_subscription_save = {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    }

    // Test 5: Request analysis (if it's a subscription attempt)
    if (req.method === 'POST' && req.body.subscription) {
      const { subscription } = req.body;
      
      results.tests.received_subscription = {
        has_subscription: !!subscription,
        has_endpoint: !!subscription?.endpoint,
        endpoint_preview: subscription?.endpoint?.substring(0, 50) + '...',
        has_keys: !!subscription?.keys,
        has_p256dh: !!subscription?.keys?.p256dh,
        has_auth: !!subscription?.keys?.auth,
        keys_preview: {
          p256dh: subscription?.keys?.p256dh?.substring(0, 20) + '...',
          auth: subscription?.keys?.auth?.substring(0, 20) + '...'
        }
      };

      // Try to process this subscription
      try {
        const subscriptionId = Buffer.from(subscription.endpoint).toString('base64').substring(0, 50);
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert({
            subscription_id: subscriptionId,
            user_id: null,
            endpoint: subscription.endpoint,
            p256dh_key: subscription.keys?.p256dh || '',
            auth_key: subscription.keys?.auth || '',
            user_ip: null, // Avoid IP format issues in debug
            user_agent: req.headers['user-agent'] || '',
            is_active: true
          }, {
            onConflict: 'subscription_id'
          })
          .select()
          .single();

        results.tests.actual_subscription_save = {
          success: !error,
          error: error?.message,
          error_code: error?.code,
          error_details: error?.details,
          data: data,
          subscription_id: subscriptionId
        };

      } catch (error) {
        results.tests.actual_subscription_save = {
          success: false,
          error: error.message,
          stack: error.stack,
          name: error.name
        };
      }
    }

    // Return results
    res.status(200).json(results);

  } catch (error) {
    results.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
    res.status(500).json(results);
  }
} 