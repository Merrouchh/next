import { createServerClient } from '@supabase/ssr';

/**
 * Server-side admin authentication helper
 * Uses non-public environment variables for better security
 */
export function createServerSupabase(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, // Fallback for compatibility
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY, // Use anon key, not service role
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
    }
  );

  return supabase;
}

/**
 * Server-side admin check with improved error handling
 * Returns user data if admin/staff, null otherwise
 */
export async function checkServerSideAdmin(req, res, requireAdmin = false) {
  try {
    // Create authenticated supabase client
    const authHeader = req.headers.authorization || req.headers.cookie;
    if (!authHeader) {
      console.log('No auth header found in request');
      return { authorized: false, user: null, redirect: '/auth/login' };
    }

    const supabase = createServerSupabase(req, res);
    
    // Get user from session with better error handling
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error in server-side check:', authError);
      return { authorized: false, user: null, redirect: '/auth/login' };
    }
    
    if (!user) {
      console.log('No authenticated user found');
      return { authorized: false, user: null, redirect: '/auth/login' };
    }
    
    // Get user profile with admin/staff status
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, email, is_admin, is_staff, gizmo_id')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return { authorized: false, user: null, redirect: '/' };
    }

    if (!profile) {
      console.log('No user profile found');
      return { authorized: false, user: null, redirect: '/' };
    }
    
    const isAdmin = !!profile.is_admin;
    const isStaff = !!profile.is_staff;
    
    // Check authorization based on requirements
    if (requireAdmin && !isAdmin) {
      console.log('Admin required but user is not admin');
      return { authorized: false, user: profile, redirect: isStaff ? '/admin/queue' : '/' };
    }
    
    if (!isAdmin && !isStaff) {
      console.log('User is neither admin nor staff');
      return { authorized: false, user: profile, redirect: '/' };
    }
    
    console.log(`User ${profile.username} authorized as ${isAdmin ? 'admin' : 'staff'}`);
    return { 
      authorized: true, 
      user: { ...profile, isAdmin, isStaff },
      redirect: null 
    };
    
  } catch (error) {
    console.error('Server-side admin check failed:', error);
    return { authorized: false, user: null, redirect: '/auth/login' };
  }
}

/**
 * Higher-order function for admin pages
 * Use this in getServerSideProps for admin pages
 */
export function withServerSideAdmin(requireAdmin = false) {
  return async function getServerSideProps(context) {
    const { req, res } = context;
    
    const authCheck = await checkServerSideAdmin(req, res, requireAdmin);
    
    if (!authCheck.authorized) {
      return {
        redirect: {
          destination: authCheck.redirect,
          permanent: false,
        },
      };
    }
    
    return {
      props: {
        user: authCheck.user,
      },
    };
  };
}
