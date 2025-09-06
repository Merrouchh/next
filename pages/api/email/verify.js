import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Initialize the Supabase admin client with service role key (for admin operations)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? 
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  ) : null;

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    // Call the database function to verify the token
    const { data: verifyResult, error: verifyError } = await supabase.rpc(
      'verify_email_with_token',
      {
        p_token: token
      }
    );

    if (verifyError) {
      console.error('Error verifying email:', verifyError);
      return res.redirect(`/auth/verification-error?error=${encodeURIComponent('Invalid or expired verification token')}`);
    }

    // If verification failed
    if (!verifyResult) {
      return res.redirect(`/auth/verification-error?error=${encodeURIComponent('Invalid or expired verification token')}`);
    }

    // Get the verification data to update the user's email
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('user_id, new_email')
      .eq('verification_token', token)
      .eq('status', 'verified')
      .single();

    if (fetchError || !verification) {
      console.error('Error fetching verification data:', fetchError);
      return res.redirect(`/auth/verification-error?error=${encodeURIComponent('Failed to retrieve verification data')}`);
    }

    // Check if admin client is available for updating user email
    if (!supabaseAdmin) {
      console.warn('Service role key not available - cannot update user email');
      return res.redirect(`/auth/verification-error?error=${encodeURIComponent('Server configuration issue - cannot update email')}`);
    }

    // Update the user's email in auth.users using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      verification.user_id,
      {
        email: verification.new_email,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('Error updating user email:', updateError);
      return res.redirect(`/auth/verification-error?error=${encodeURIComponent('Failed to update email address')}`);
    }

    // Redirect to success page
    return res.redirect('/auth/verification-success?type=email_change&verified=true');
  } catch (error) {
    console.error('Server error during email verification:', error);
    return res.redirect(`/auth/verification-error?error=${encodeURIComponent('An unexpected error occurred')}`);
  }
} 