import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Extract the token, type and return_to params
  const { token, type, return_to } = req.query;

  if (!token || !type) {
    console.error('Missing required parameters:', { token: !!token, type });
    return res.redirect('/auth/verification-failed');
  }

  try {
    // Create a Supabase client
    const supabase = createClient(req, res);
    
    // For email_change type, we need to handle it differently
    if (type === 'email_change') {
      // The token is already being processed by Supabase automatically
      // We just need to get the user to check if verification was successful
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting user during verification:', error);
        return res.redirect('/auth/verification-failed');
      }
      
      // If we have a user, the verification was successful
      if (data?.user) {
        // If there's a return_to parameter, use it
        if (return_to) {
          return res.redirect(return_to);
        }
        
        // Otherwise redirect to our success page with the email as a query param
        const successUrl = new URL('/auth/verification-success', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
        successUrl.searchParams.append('type', 'email_change');
        successUrl.searchParams.append('email', data.user.email);
        return res.redirect(successUrl.toString());
      }
    } else {
      // For other verification types
      // If there's a return_to parameter, use it
      if (return_to) {
        return res.redirect(return_to);
      }
      
      // Otherwise redirect to our standard success page
      const successUrl = new URL('/auth/verification-success', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
      if (type) successUrl.searchParams.append('type', type);
      return res.redirect(successUrl.toString());
    }
    
    // If we reach here, something went wrong
    return res.redirect('/auth/verification-failed');
  } catch (error) {
    console.error('Error handling verification:', error);
    return res.redirect('/auth/verification-failed');
  }
} 