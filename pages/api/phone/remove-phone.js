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

    // Try multiple approaches to update the auth.users table
    let authUpdateSuccess = false;

    // Approach 1: Try the SQL function if it exists
    try {
      console.log('Trying SQL function approach to remove phone from auth.users');
      
      const { data, error } = await supabase.rpc('public.clear_user_phone', { 
        user_id: userId 
      });
      
      if (error) {
        // If public schema doesn't work, try without schema prefix
        const { data: data2, error: error2 } = await supabase.rpc('clear_user_phone', { 
          user_id: userId 
        });
        
        if (error2) {
          console.error('SQL function not available:', error2);
        } else {
          console.log('Successfully removed phone from auth user using SQL function without schema');
          authUpdateSuccess = true;
        }
      } else {
        console.log('Successfully removed phone from auth user using SQL function with schema');
        authUpdateSuccess = true;
      }
    } catch (functionError) {
      console.error('Error with SQL function approach:', functionError);
    }

    // Approach 2: Try direct update via API if function approach failed
    if (!authUpdateSuccess) {
      try {
        console.log('Trying updateUser API approach to remove phone');
        // Get the admin token for the current user
        const { data: authData, error: adminError } = await supabase.auth.admin.getUserById(userId);
        
        if (adminError) {
          console.error('Error getting admin user data:', adminError);
        } else {
          // Try to update the user via admin API
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            { phone: null }
          );
          
          if (updateError) {
            console.error('Error with admin updateUser method:', updateError);
            
            // Try one more approach - sometimes an empty string works better than null
            const { error: emptyStringError } = await supabase.auth.admin.updateUserById(
              userId,
              { phone: '' }
            );
            
            if (emptyStringError) {
              console.error('Error with empty string approach:', emptyStringError);
            } else {
              console.log('Successfully removed phone from auth user using empty string');
              authUpdateSuccess = true;
            }
          } else {
            console.log('Successfully removed phone from auth user with admin API');
            authUpdateSuccess = true;
          }
        }
      } catch (apiError) {
        console.error('Auth API error (non-fatal):', apiError);
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