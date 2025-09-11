import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase admin client with service role key
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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST instead.' });
  }

  try {
    const { userId, phone, verificationId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`Cancelling phone verification for user: ${userId}`);
    
    // If verification ID is provided, try to delete that specific record
    if (verificationId) {
      const { error: deleteError } = await supabaseAdmin
        .from('phone_verification_attempts')
        .delete()
        .eq('id', verificationId);
      
      if (deleteError) {
        console.warn('Error deleting specific verification record:', deleteError);
        // Continue to try other deletion methods
      } else {
        console.log('Successfully deleted verification record by ID');
      }
    }
    
    // Also try to delete by user_id and phone if provided
    if (userId && phone) {
      const { error: deleteByPhoneError } = await supabaseAdmin
        .from('phone_verification_attempts')
        .delete()
        .eq('user_id', userId)
        .eq('phone', phone)
        .eq('verified', false);
      
      if (deleteByPhoneError) {
        console.warn('Error deleting verification by phone:', deleteByPhoneError);
      } else {
        console.log('Successfully deleted verification records by phone');
      }
    }
    
    // Delete all verification records for this user as a fallback
    const { error: deleteAllError } = await supabaseAdmin
      .from('phone_verification_attempts')
      .delete()
      .eq('user_id', userId)
      .eq('verified', false);
    
    if (deleteAllError) {
      console.warn('Error deleting all user verification records:', deleteAllError);
    } else {
      console.log('Successfully deleted all pending verification records');
    }
    
    // Also delete any pending verification codes
    const { error: deleteCodesError } = await supabaseAdmin
      .from('phone_verification_codes')
      .delete()
      .eq('user_id', userId);
      
    if (deleteCodesError) {
      console.warn('Error deleting verification codes:', deleteCodesError);
    } else {
      console.log('Successfully deleted verification codes');
    }

    return res.status(200).json({ 
      message: 'Phone verification cancelled successfully',
      status: 'success' 
    });

  } catch (error) {
    console.error('Error in cancel-verification:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
} 