import { createServerClient } from '@supabase/ssr';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create Supabase client with server-side keys
    const supabase = createServerClient(
      process.env.SUPABASE_URL, // Server-side URL (no NEXT_PUBLIC_)
      process.env.SUPABASE_ANON_KEY, // Server-side anon key (no NEXT_PUBLIC_)
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, email, is_admin, is_staff, gizmo_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    return res.status(200).json({
      user: {
        ...profile,
        isAdmin: !!profile.is_admin,
        isStaff: !!profile.is_staff
      }
    });

  } catch (error) {
    console.error('User API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
