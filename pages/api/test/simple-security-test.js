// SIMPLE DEBUG TEST - Check this in browser
export default async function handler(req, res) {
  const results = {};
  
  // Check environment variables
  results.env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  };

  // Test service role client (preferred) or fallback client
  let supabase = null;
  try {
    const { createServiceRoleClient } = await import('../../../utils/supabase/secure-server');
    supabase = createServiceRoleClient();
    results.serviceRole = { success: true, error: null, type: 'service_role' };
  } catch (err) {
    results.serviceRole = { success: false, error: err.message, type: 'service_role' };
    
    // Try fallback to regular client
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        results.fallbackClient = { success: true, error: null, type: 'public_client' };
      } else {
        results.fallbackClient = { success: false, error: 'No public keys available' };
      }
    } catch (fallbackErr) {
      results.fallbackClient = { success: false, error: fallbackErr.message };
    }
  }
  
  // Test table access with whatever client we have
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('security_events')
        .select('id')
        .limit(1);
      
      results.tableAccess = { 
        success: !error, 
        error: error?.message || null,
        hasData: !!data?.length,
        clientType: results.serviceRole.success ? 'service_role' : 'public'
      };
    } catch (err) {
      results.tableAccess = { success: false, error: err.message };
    }
  } else {
    results.tableAccess = { success: false, error: 'No Supabase client available' };
  }

  // Test logging function
  try {
    const { logSecurityEvent } = await import('../../../utils/security/notifications');
    
    await logSecurityEvent({
      type: 'test_debug_event',
      username: 'debug_user',
      ip_address: '127.0.0.1',
      user_agent: 'Debug Test',
      attempted_path: '/debug',
      details: 'Debug test event',
      severity: 'low'
    });
    
    results.logging = { success: true, error: null };
  } catch (err) {
    results.logging = { success: false, error: err.message };
  }

  // Generate recommendations
  const issues = [];
  const warnings = [];
  
  // Check if we have any working Supabase connection
  const hasWorkingConnection = results.serviceRole.success || (results.fallbackClient && results.fallbackClient.success);
  
  if (!hasWorkingConnection) {
    if (!results.env.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push('Missing NEXT_PUBLIC_SUPABASE_URL - Get from Supabase Dashboard > Settings > API');
    }
    if (!results.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      issues.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY - Get from Supabase Dashboard > Settings > API');
    }
  }
  
  if (!results.env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push('⚠️ SUPABASE_SERVICE_ROLE_KEY missing - using public client (may have RLS restrictions)');
  }
  
  if (!results.tableAccess.success) {
    issues.push('Cannot access security_events table: ' + results.tableAccess.error);
  }
  
  if (!results.logging.success) {
    issues.push('Logging failed: ' + results.logging.error);
  }

  return res.status(200).json({
    status: issues.length === 0 ? '✅ ALL GOOD' : '❌ ISSUES FOUND',
    results,
    issues,
    warnings,
    nextSteps: issues.length === 0 ? [
      '1. Try accessing /admin pages with non-admin user',
      '2. Check /admin/notifications for logged events',
      ...(warnings.length > 0 ? ['3. Consider adding SUPABASE_SERVICE_ROLE_KEY for better security'] : [])
    ] : [
      '1. Fix the issues listed above',
      '2. Re-run this test'
    ]
  });
}
