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
    const { userId, phone } = req.body;

    if (!userId || !phone) {
      return res.status(400).json({ error: 'User ID and phone number are required' });
    }

    // Get the client IP address
    const ipAddress = req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      null;

    console.log(`Creating phone verification record for user ${userId} with phone ${phone}`);

    // First, delete any existing pending verifications for this user and phone
    const { error: deleteError } = await supabaseAdmin
      .from('phone_verification_attempts')
      .delete()
      .eq('user_id', userId)
      .eq('phone', phone)
      .eq('verified', false);

    if (deleteError) {
      console.warn('Error deleting existing verification records:', deleteError);
      // Continue anyway - this is just cleanup
    }

    // Create a new verification record
    const { data: record, error: insertError } = await supabaseAdmin
      .from('phone_verification_attempts')
      .insert({
        user_id: userId,
        phone: phone,
        ip_address: ipAddress,
        otp_sent: false,
        verified: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating verification record:', insertError);
      return res.status(500).json({ 
        error: 'Failed to create verification record',
        details: insertError.message
      });
    }

    // Return success with the created record
    return res.status(200).json({
      success: true,
      record
    });

  } catch (error) {
    console.error('Error in create-verification-record:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
} 