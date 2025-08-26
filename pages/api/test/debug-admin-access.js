// Debug what happens during admin access attempts
export default async function handler(req, res) {
  console.log('🔍 DEBUG: Admin access debug endpoint called');
  
  try {
    // Step 1: Test if our security logging API works
    console.log('🔍 Step 1: Testing security logging API...');
    
    const testLogResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/security/log-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'debug_test',
        username: 'debug_user',
        attempted_path: '/debug',
        details: 'Debug test from admin access debug endpoint',
        severity: 'low'
      })
    });

    const logResult = await testLogResponse.json();
    console.log('🔍 Security logging API result:', logResult);

    // Step 2: Check if we can read from security_events table
    console.log('🔍 Step 2: Testing database read...');
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data: events, error: readError } = await supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('🔍 Database read result:', { events: events?.length, error: readError });

    return res.status(200).json({
      success: true,
      tests: {
        securityLoggingAPI: {
          success: testLogResponse.ok,
          result: logResult
        },
        databaseRead: {
          success: !readError,
          eventCount: events?.length || 0,
          error: readError?.message || null,
          latestEvents: events?.slice(0, 2) || []
        }
      },
      instructions: [
        '1. Check the console logs above for detailed debug info',
        '2. Try accessing /admin in incognito mode',
        '3. Check browser console for any errors',
        '4. Run this debug endpoint again to see if new events were logged'
      ]
    });

  } catch (error) {
    console.error('🔍 DEBUG: Error in admin access debug:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
