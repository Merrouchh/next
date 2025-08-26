// Production-safe security debug endpoint
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results = {
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      domain: req.headers.host,
      url: req.url
    };

    // Check environment variables (without exposing values)
    results.envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV
    };

    // Test Supabase connection
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        results.supabaseTest = {
          success: false,
          error: 'Missing Supabase credentials'
        };
      } else {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Test table access
        const { data, error } = await supabase
          .from('security_events')
          .select('id')
          .limit(1);

        results.supabaseTest = {
          success: !error,
          error: error?.message || null,
          hasTable: !error,
          eventCount: data?.length || 0
        };
      }
    } catch (supabaseError) {
      results.supabaseTest = {
        success: false,
        error: supabaseError.message
      };
    }

    // Test security logging function
    try {
      const { logSecurityEvent } = await import('../../../utils/security/notifications');
      
      await logSecurityEvent({
        type: 'production_debug_test',
        user_id: null,
        username: 'production_debug',
        ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        attempted_path: '/debug/production-test',
        details: `Production debug test from ${req.headers.host}`,
        severity: 'low'
      });

      results.loggingTest = {
        success: true,
        message: 'Security event logged successfully'
      };
    } catch (loggingError) {
      results.loggingTest = {
        success: false,
        error: loggingError.message
      };
    }

    // Generate recommendations
    const issues = [];
    const warnings = [];

    if (!results.envCheck.NEXT_PUBLIC_SUPABASE_URL && !results.envCheck.SUPABASE_URL) {
      issues.push('Missing Supabase URL in production environment');
    }

    if (!results.envCheck.NEXT_PUBLIC_SUPABASE_ANON_KEY && !results.envCheck.SUPABASE_ANON_KEY) {
      issues.push('Missing Supabase anon key in production environment');
    }

    if (!results.supabaseTest.success) {
      issues.push('Supabase connection failed: ' + results.supabaseTest.error);
    }

    if (!results.supabaseTest.hasTable) {
      issues.push('security_events table not found or not accessible');
    }

    if (!results.loggingTest.success) {
      issues.push('Security logging failed: ' + results.loggingTest.error);
    }

    if (!results.envCheck.SUPABASE_SERVICE_ROLE_KEY) {
      warnings.push('Service role key missing - using fallback client (may have RLS restrictions)');
    }

    return res.status(200).json({
      status: issues.length === 0 ? '✅ ALL GOOD' : '❌ ISSUES FOUND',
      results,
      issues,
      warnings,
      nextSteps: issues.length === 0 ? [
        'Security logging should be working in production',
        'Try accessing admin pages without login to test'
      ] : [
        'Fix the issues listed above',
        'Check your hosting platform environment variables',
        'Ensure security_events table exists in production database'
      ]
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
