import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Create a Supabase client
    const supabase = createClient(req, res);
    
    // Check if user exists with this email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, username')
      .eq('email', email.toLowerCase())
      .single();
    
    if (userError || !userData) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ 
        message: 'If an account with this email exists, a password reset link has been sent.' 
      });
    }
    
    // Send password reset email using Supabase
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.toLowerCase(),
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password`
      }
    );
    
    if (resetError) {
      console.error('Password reset error:', resetError);
      return res.status(500).json({ error: 'Failed to send reset email' });
    }
    
    // Log the password reset request (optional)
    console.log(`Password reset requested for email: ${email}`);
    
    return res.status(200).json({ 
      message: 'If an account with this email exists, a password reset link has been sent.' 
    });
    
  } catch (error) {
    console.error('Password reset API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 