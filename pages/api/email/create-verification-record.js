import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase admin client with service role key
// This allows us to bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, currentEmail, newEmail } = req.body;
    
    if (!userId || !currentEmail || !newEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('Creating verification record for user:', { userId, currentEmail, newEmail });
    
    // First, clean up any existing pending verifications for this user
    try {
      const { error: deleteError } = await supabaseAdmin
        .from('email_verifications')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'pending');
        
      if (deleteError) {
        console.warn('Error deleting existing verifications:', deleteError);
      }
    } catch (deleteError) {
      console.warn('Exception during cleanup:', deleteError);
      // Continue anyway - this is just cleanup
    }
    
    // Use direct SQL to insert with RETURNING * to avoid trigger issues
    try {
      const insertQuery = `
        INSERT INTO email_verifications (
          user_id, current_email, new_email, verification_token, status, 
          created_at, expires_at
        ) VALUES (
          '${userId}', '${currentEmail}', '${newEmail}', 'supabase-managed', 
          'pending', NOW(), NOW() + INTERVAL '1 hour'
        ) RETURNING *;
      `;
      
      const { data: result, error: sqlError } = await supabaseAdmin.rpc(
        'pgexecutesql', 
        { query: insertQuery }
      );
      
      if (sqlError) {
        console.error('SQL error:', sqlError);
        throw new Error(`Failed to insert record: ${sqlError.message}`);
      }
      
      console.log('SQL result:', result);
      
      // Get the created record
      const { data: verificationData, error: fetchError } = await supabaseAdmin
        .from('email_verifications')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (fetchError) {
        console.error('Error fetching created record:', fetchError);
        throw new Error('Record was inserted but could not be retrieved');
      }
      
      console.log('Successfully created verification record:', verificationData);
      return res.status(200).json({ success: true, record: verificationData });
      
    } catch (insertError) {
      console.error('Error during direct SQL insert:', insertError);
      
      // Last resort: try standard Supabase insert
      try {
        console.log('Attempting standard insert as fallback');
        const { data, error } = await supabaseAdmin
          .from('email_verifications')
          .insert({
            user_id: userId,
            current_email: currentEmail,
            new_email: newEmail,
            verification_token: 'supabase-managed',
            status: 'pending'
          })
          .select()
          .single();
          
        if (error) {
          console.error('Fallback insert also failed:', error);
          throw new Error(`Standard insert failed: ${error.message}`);
        }
        
        console.log('Fallback insert succeeded:', data);
        return res.status(200).json({ success: true, record: data });
      } catch (fallbackError) {
        console.error('All insert attempts failed:', fallbackError);
        return res.status(500).json({ 
          error: 'Failed to create verification record after multiple attempts', 
          details: fallbackError.message 
        });
      }
    }
  } catch (error) {
    console.error('Error in create-verification-record API:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred', 
      details: error.message 
    });
  }
} 