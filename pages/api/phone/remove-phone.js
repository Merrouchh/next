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
      // Continue anyway - we'll still try to remove from Auth too
    } else {
      console.log('Successfully removed phone from users table');
    }

    // Try Auth API methods to update the auth user
    let authUpdateSuccess = false;

    // Approach 1: Try admin.updateUserById with empty string
    try {
      console.log('Trying admin.updateUserById with empty string');
      
      const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        { phone: '' }
      );
      
      if (error) {
        console.error('Error with admin.updateUserById (empty string):', error);
      } else {
        console.log('Successfully removed phone using admin.updateUserById with empty string');
        authUpdateSuccess = true;
      }
    } catch (error1) {
      console.error('Exception with admin.updateUserById approach:', error1);
    }

    // Approach 2: Try admin.updateUserById with null if first approach failed
    if (!authUpdateSuccess) {
      try {
        console.log('Trying admin.updateUserById with null');
        
        const { data, error } = await supabase.auth.admin.updateUserById(
          userId,
          { phone: null }
        );
        
        if (error) {
          console.error('Error with admin.updateUserById (null):', error);
        } else {
          console.log('Successfully removed phone using admin.updateUserById with null');
          authUpdateSuccess = true;
        }
      } catch (error2) {
        console.error('Exception with admin.updateUserById (null) approach:', error2);
      }
    }

    // Try to clean up verification records - handle possible errors gracefully
    try {
      // Check if phone_verifications table exists before trying to delete
      const { data: tableData, error: tableError } = await supabase
        .from('phone_verifications')
        .select('id')
        .limit(1);
      
      if (!tableError) {
        // Table exists, try to delete records
        const { error: removeVerificationError } = await supabase
          .from('phone_verifications')
          .delete()
          .eq('user_id', userId);
        
        if (removeVerificationError) {
          console.error('Error removing phone verification record:', removeVerificationError);
        }
      }
    } catch (verificationError) {
      console.error('Error checking/deleting phone_verifications (non-fatal):', verificationError);
    }
    
    // Try to clean up verification codes - handle possible errors gracefully
    try {
      // Check if phone_verification_codes table exists
      const { data: codesTableData, error: codesTableError } = await supabase
        .from('phone_verification_codes')
        .select('id')
        .limit(1);
      
      if (!codesTableError) {
        // Table exists, try to delete records
        const { error: removeCodesError } = await supabase
          .from('phone_verification_codes')
          .delete()
          .eq('user_id', userId);
        
        if (removeCodesError) {
          console.error('Error removing phone verification codes:', removeCodesError);
        }
      }
    } catch (codesError) {
      console.error('Error checking/deleting phone_verification_codes (non-fatal):', codesError);
    }

    // Return success even if some steps failed
    console.log('Phone number removal process completed for user:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Phone number removed from your profile',
      details: {
        userTableUpdated: !updateUserError,
        authUpdated: authUpdateSuccess
      }
    });
  } catch (error) {
    console.error('Error in remove-phone API:', error);
    return res.status(500).json({ 
      error: 'An error occurred while removing the phone number',
      message: error.message
    });
  }
} 