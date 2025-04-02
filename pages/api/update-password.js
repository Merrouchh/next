import createClient from '../../utils/supabase/api';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  try {
    // Create a Supabase client with the user's session
    const supabase = createClient(req, res);
    
    // Get the current user
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    
    if (getUserError || !user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Verify current password by trying to sign in
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      
      if (signInError) {
        console.log('Sign-in error:', signInError.message);
        return res.status(401).json({ 
          message: 'Current password is incorrect',
          code: 'INCORRECT_PASSWORD'
        });
      }
    } catch (signInErr) {
      console.error('Sign-in exception:', signInErr);
      return res.status(401).json({ 
        message: 'Current password is incorrect',
        code: 'INCORRECT_PASSWORD'
      });
    }
    
    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (updateError) {
      return res.status(400).json({ message: updateError.message });
    }
    
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
} 