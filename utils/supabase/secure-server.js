import { createServerClient } from '@supabase/ssr';

/**
 * Create a secure server-side Supabase client
 * Uses server-side environment variables (not exposed to client)
 */
export function createSecureServerClient(req, res, options = {}) {
  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, // Server-side with fallback
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Server-side with fallback
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies).map((name) => ({ 
            name, 
            value: req.cookies[name] || '' 
          }));
        },
        setAll(cookiesToSet) {
          res.setHeader(
            'Set-Cookie',
            cookiesToSet.map(({ name, value, options }) =>
              `${name}=${value}; Path=/; ${options?.httpOnly ? 'HttpOnly; ' : ''}${options?.secure ? 'Secure; ' : ''}${options?.sameSite ? `SameSite=${options.sameSite}; ` : ''}`
            )
          );
        },
      },
      global: options.global || {}
    }
  );

  return supabase;
}

/**
 * Create a service role client for admin operations
 */
export function createServiceRoleClient() {
  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY, // Service role for admin operations
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return supabase;
}

/**
 * Middleware to authenticate API requests
 */
export async function authenticateRequest(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Missing or invalid authorization header' };
    }

    const supabase = createSecureServerClient(req, res, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { authenticated: false, error: 'Invalid session' };
    }

    // Get user profile with roles
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, email, is_admin, is_staff, gizmo_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return { authenticated: false, error: 'Failed to fetch user profile' };
    }

    return { 
      authenticated: true, 
      user: {
        ...profile,
        isAdmin: !!profile.is_admin,
        isStaff: !!profile.is_staff
      },
      supabase
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return { authenticated: false, error: 'Authentication failed' };
  }
}
