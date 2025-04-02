import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, type, redirect_to } = req.query;

  if (!token || !type) {
    console.error('Missing token or type parameter');
    return res.redirect('/auth/verification-failed?error_code=missing_params&error_description=Missing+required+parameters');
  }

  try {
    // Create server-side Supabase client
    const supabase = createClient(req, res);
    
    // Check if this is a magic link
    if (type === 'magiclink' || type === 'recovery') {
      console.log('Server-side processing of magic link token');
      
      // Verify the OTP token
      const { data, error } = await supabase.auth.verifyOtp({
        token,
        type
      });
      
      if (error) {
        console.error('Error verifying magic link:', error);
        return res.redirect(`/auth/verification-failed?error_code=${error.code || 'verification_error'}&error_description=${encodeURIComponent(error.message)}`);
      }
      
      // Successfully authenticated
      console.log('Magic link verification successful');
      
      // Redirect to dashboard or the specified redirect URL
      const redirectUrl = redirect_to || '/dashboard';
      return res.redirect(redirectUrl);
    }
    
    // Handle other verification types
    return res.redirect('/auth/callback?' + new URLSearchParams({
      token,
      type
    }).toString());
  } catch (error) {
    console.error('Error handling magic link:', error);
    return res.redirect('/auth/verification-failed');
  }
} 