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

    // Try multiple approaches to update the auth user
    // Once auth.users is updated, the users table will be updated automatically via triggers
    let authUpdateSuccess = false;

    // Approach 1: Try admin.updateUserById with empty string first
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

    // Approach 3: Direct SQL approach via pg_admin as last resort
    if (!authUpdateSuccess) {
      try {
        console.log('Trying direct SQL approach via pg_admin');
        
        // The SQL command to directly update auth.users table
        const sql = `
          UPDATE auth.users 
          SET 
            phone = NULL,
            phone_confirmed_at = NULL,
            phone_change = '',
            phone_change_token = '',
            phone_change_sent_at = NULL
          WHERE id = '${userId}';
        `;
        
        // Execute the SQL command
        const { error } = await supabase.rpc('pg_admin', {
          sql
        });
        
        if (error) {
          console.error('Error with direct SQL approach:', error);
          
          // Try another RPC method name if pg_admin doesn't exist
          try {
            const { error: error2 } = await supabase.rpc('pg_execute', {
              query: sql
            });
            
            if (error2) {
              console.error('Error with pg_execute approach:', error2);
            } else {
              console.log('Successfully removed phone using direct SQL via pg_execute');
              authUpdateSuccess = true;
            }
          } catch (error3) {
            console.error('Exception with pg_execute approach:', error3);
          }
        } else {
          console.log('Successfully removed phone using direct SQL via pg_admin');
          authUpdateSuccess = true;
        }
      } catch (sqlError) {
        console.error('Exception with direct SQL approach:', sqlError);
      }
    }

    if (!authUpdateSuccess) {
      return res.status(500).json({
        success: false,
        message: 'Failed to remove phone number after multiple attempts',
        details: 'All Auth API methods failed'
      });
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

    // Return success since auth update was successful
    console.log('Phone number removal process completed successfully for user:', userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Phone number removed from your profile'
    });
  } catch (error) {
    console.error('Error in remove-phone API:', error);
    return res.status(500).json({ 
      error: 'An error occurred while removing the phone number',
      message: error.message
    });
  }
} 