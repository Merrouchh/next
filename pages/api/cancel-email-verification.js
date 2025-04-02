import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase admin client with service role key
// This allows us to directly modify user data
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

    // Log attempt for debugging
    console.log(`Attempting to cancel email verification for user: ${userId}`);

    // Update the verification record to cancelled status
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('email_verifications')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();
      
    if (updateError) {
      console.error('Error updating email_verifications record:', updateError);
      return res.status(500).json({ error: 'Failed to cancel verification' });
    }

    // Clear the new_email field from auth.users table
    try {
      const rawSqlQuery = `
        UPDATE auth.users
        SET 
          new_email = NULL,
          email_change_token_current = NULL,
          email_change_token_new = NULL,
          email_change_confirm_status = 0,
          email_change_sent_at = NULL,
          updated_at = NOW()
        WHERE id = '${userId}'
      `;

      const { error: sqlError } = await supabaseAdmin.rpc(
        'pgexecutesql', 
        { query: rawSqlQuery }
      );
      
      if (sqlError) {
        console.warn('Direct SQL update failed:', sqlError);
      }
    } catch (sqlError) {
      console.warn('Error executing SQL query:', sqlError);
    }

    console.log('Successfully cancelled email verification');
    return res.status(200).json({ 
      message: 'Email verification cancelled successfully',
      status: 'success',
      record: updatedRecord
    });

  } catch (error) {
    console.error('Error in cancel-email-verification:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
} 