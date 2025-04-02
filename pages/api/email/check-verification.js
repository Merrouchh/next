import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST instead.' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`Checking verification status for user: ${userId}`);

    // Check our custom email_verifications table
    const { data: pendingRecord, error: recordError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    const hasPendingRecord = !recordError && pendingRecord;
    
    console.log('Pending verification check from custom table:', {
      hasPendingRecord,
      pendingRecord: hasPendingRecord ? pendingRecord : null
    });
    
    return res.status(200).json({
      hasPendingRecord,
      pendingRecord: hasPendingRecord ? pendingRecord : null
    });

  } catch (error) {
    console.error('Error in check-verification:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
} 