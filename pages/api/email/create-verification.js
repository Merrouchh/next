import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create a Supabase admin client for operations that require admin privileges
// const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? // Removed unused variable
//   createClient(
//     process.env.SUPABASE_URL,
//     process.env.SUPABASE_SERVICE_ROLE_KEY,
//     {
//       auth: {
//         autoRefreshToken: false,
//         persistSession: false
//       }
//     }
//   ) : null;

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
    const currentEmail = user.email;
    const { newEmail, password } = req.body;

    if (!newEmail) {
      return res.status(400).json({ error: 'New email address is required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required for verification' });
    }

    // Verify the user's password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: password,
    });

    if (signInError) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    // Create a new email verification record
    const { data: verificationId, error: verificationError } = await supabase.rpc(
      'create_email_verification',
      {
        p_user_id: userId,
        p_current_email: currentEmail,
        p_new_email: newEmail
      }
    );

    if (verificationError) {
      console.error('Error creating email verification:', verificationError);
      return res.status(500).json({ error: 'Failed to create email verification' });
    }

    // Get the verification record with the token
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('verification_token, new_email')
      .eq('id', verificationId)
      .single();

    if (fetchError) {
      console.error('Error fetching verification token:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch verification token' });
    }

    // Generate verification link
    const baseUrl = process.env.SITE_URL || 'http://localhost:3000';
    const verificationLink = `${baseUrl}/api/email/verify?token=${verification.verification_token}`;

    // Send email using Supabase
    const emailResult = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email: newEmail,
        template_id: 'd-email-verification', // You need to create this template in Supabase Email Templates
        data: {
          verification_link: verificationLink,
          site_name: 'Merrouch Gaming',
          support_email: 'support@merrouchgaming.com'
        }
      })
    });

    let emailSent = emailResult.ok;
    let emailError = null;

    if (!emailSent) {
      const errorData = await emailResult.json();
      emailError = errorData.error || 'Unknown error sending email';
      console.error('Failed to send email via Supabase:', emailError);
    }

    // Return appropriate response
    return res.status(200).json({ 
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      newEmail
    });
  } catch (error) {
    console.error('Server error during email verification creation:', error);
    return res.status(500).json({ error: 'An unexpected error occurred', details: error.message });
  }
} 