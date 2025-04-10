import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Phone removal request for user:', userId);

    // Update the user record in the users table to remove the phone number
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ phone: null })
      .eq('id', userId);

    if (updateUserError) {
      console.error('Error removing phone from user record:', updateUserError);
      return res.status(500).json({ error: 'Failed to remove phone from user record' });
    }

    // Try to update the auth user to remove the phone number
    try {
      console.log('Attempting to update auth user to remove phone number');
      
      // Using the admin API to update the user
      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
        userId,
        { phone: null }
      );
      
      if (updateAuthError) {
        console.error('Error removing phone from auth user:', updateAuthError);
        // We'll continue even if this fails
      } else {
        console.log('Successfully removed phone from auth user');
      }
    } catch (authError) {
      console.error('Auth update error (non-fatal):', authError);
      // Continue with the process even if this fails
    }

    // Remove from phone_verifications table if it exists
    const { error: removeVerificationError } = await supabase
      .from('phone_verifications')
      .delete()
      .eq('user_id', userId);
    
    if (removeVerificationError) {
      console.error('Error removing phone verification record:', removeVerificationError);
      // Non-fatal error
    }

    // Remove from phone_verification_codes if any exist
    const { error: removeCodesError } = await supabase
      .from('phone_verification_codes')
      .delete()
      .eq('user_id', userId);
    
    if (removeCodesError) {
      console.error('Error removing phone verification codes:', removeCodesError);
      // Non-fatal error
    }

    console.log('Phone number removed successfully for user:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Phone number removed successfully'
    });
  } catch (error) {
    console.error('Error in remove-phone API:', error);
    return res.status(500).json({ 
      error: 'An error occurred while removing the phone number',
      message: error.message
    });
  }
} 