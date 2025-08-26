// Direct test to trigger security logging
export default async function handler(req, res) {
  console.log('🔥 TRIGGER: Direct security log test');
  
  try {
    // Import the logging function directly
    const { logSecurityEvent } = await import('../../../utils/security/notifications');
    
    // Log a test event directly
    await logSecurityEvent({
      type: 'direct_test_event',
      user_id: null,
      username: 'direct_test_user',
      ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Test Agent',
      attempted_path: '/admin',
      details: 'Direct test event triggered from API',
      severity: 'low'
    });

    console.log('🔥 TRIGGER: Security event logged successfully');

    // Check if the event was actually saved
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

    const { data: events, error } = await supabase
      .from('security_events')
      .select('*')
      .eq('event_type', 'direct_test_event')
      .order('created_at', { ascending: false })
      .limit(1);

    return res.status(200).json({
      success: true,
      message: 'Direct security event logged',
      eventSaved: !error && events?.length > 0,
      event: events?.[0] || null,
      error: error?.message || null,
      nextStep: 'Check /admin/notifications to see if this event appears'
    });

  } catch (error) {
    console.error('🔥 TRIGGER: Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
