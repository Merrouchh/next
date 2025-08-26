// Immediate logging test - no complex logic
export default async function handler(req, res) {
  console.log('🔥 IMMEDIATE TEST: Starting...');
  
  try {
    // Test 1: Check if we have NEXT_PUBLIC keys
    const hasPublicUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasPublicKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('🔥 NEXT_PUBLIC_SUPABASE_URL:', hasPublicUrl);
    console.log('🔥 NEXT_PUBLIC_SUPABASE_ANON_KEY:', hasPublicKey);
    
    if (!hasPublicUrl || !hasPublicKey) {
      return res.status(200).json({
        error: 'Missing NEXT_PUBLIC Supabase keys',
        hasUrl: hasPublicUrl,
        hasKey: hasPublicKey,
        message: 'Check next.config.js for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      });
    }
    
    // Test 2: Try to create Supabase client directly
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
    
    console.log('🔥 Supabase client created successfully');
    
    // Test 3: Try to insert a simple test record
    const testRecord = {
      event_type: 'immediate_test',
      username: 'test_user',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      attempted_path: '/test',
      details: 'Immediate test record',
      severity: 'low'
    };
    
    console.log('🔥 Attempting to insert test record:', testRecord);
    
    const { data, error } = await supabase
      .from('security_events')
      .insert(testRecord)
      .select();
    
    if (error) {
      console.log('🔥 INSERT ERROR:', error);
      return res.status(200).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: 'Database insert failed - this might be due to missing table or RLS policies'
      });
    }
    
    console.log('🔥 INSERT SUCCESS:', data);
    
    return res.status(200).json({
      success: true,
      message: 'Test record inserted successfully!',
      data: data,
      nextStep: 'Check /admin/notifications to see if it appears'
    });
    
  } catch (error) {
    console.log('🔥 GENERAL ERROR:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}
