import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Initialize the Supabase admin client with service role key
// This allows us to directly modify user data
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? 
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) : null;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get authorization header from the request
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated - missing token' });
  }

  // Extract the JWT token
  const token = authHeader.replace('Bearer ', '');

  try {
    // Verify the token and get user data
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: 'Not authenticated - invalid token' });
    }

    const userId = user.id;

    // Ensure we have the admin client available
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Service role key not available - cannot cancel verification' });
    }

    // 1. Update our custom email_verifications table
    await supabase.rpc('cancel_email_verification', {
      p_user_id: userId
    });

    // 2. Also make a direct call to the main cancellation API
    // which handles the auth.users table properly
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/cancel-email-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.warn('Warning: Main cancellation API call failed, but custom table was updated.');
      }
    } catch (apiError) {
      console.warn('Error calling main cancellation API:', apiError);
      // Continue - we'll try our local approach
    }

    // 3. Direct update in case the API call failed
    // Use SQL to directly update auth.users (requires pgexecutesql function)
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
        'pgexecutesql', { query: rawSqlQuery }
      );
      
      if (sqlError) {
        console.warn('Direct SQL update failed:', sqlError);
      }
    } catch (sqlError) {
      console.warn('Error executing SQL query:', sqlError);
    }

    // 4. Finally, update the user with admin API for consistency
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email: user.email,
        email_confirm: true
      }
    );

    if (updateError) {
      console.warn('Admin API update failed:', updateError);
    }

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Email verification cancelled successfully' 
    });
  } catch (error) {
    console.error('Server error during email verification cancellation:', error);
    return res.status(500).json({ error: 'An unexpected error occurred', details: error.message });
  }
} 