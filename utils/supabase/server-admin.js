import { createServerClient } from '@supabase/ssr';
import { logUnauthorizedAdminAccess, logUnauthorizedStaffAccess } from '../security/notifications';

/**
 * Server-side admin authentication helper
 * Uses non-public environment variables for better security
 */
export function createServerSupabase(req, res) {
  const supabase = createServerClient(
    process.env.SUPABASE_URL, // Server-side only
    process.env.SUPABASE_ANON_KEY, // Server-side only
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
  console.log('🔍 SERVER: checkServerSideAdmin called for:', req.url);
  try {
    // Create authenticated supabase client
    const authHeader = req.headers.authorization || req.headers.cookie;
    console.log('🔍 SERVER: Auth header present:', !!authHeader);
    if (!authHeader) {
      console.log('🔍 SERVER: No auth header found - user not logged in');
      
      // 🚨 SECURITY: Log unauthenticated access attempt
      console.log('🚨 SERVER: Logging unauthenticated access attempt');
      console.log('🚨 SERVER: Environment:', process.env.NODE_ENV, 'Domain:', req.headers.host);
      try {
        await logUnauthorizedAdminAccess({ username: 'anonymous', id: null }, req);
        console.log('🚨 SERVER: Unauthenticated access logged successfully');
      } catch (logError) {
        console.error('🚨 SERVER: Failed to log unauthenticated access:', logError);
      }
      
      return { authorized: false, user: null, redirect: '/' };
    }

    const supabase = createServerSupabase(req, res);
    
    // Get user from session with better error handling
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error in server-side check:', authError);
      return { authorized: false, user: null, redirect: '/' };
    }
    
    if (!user) {
      console.log('No authenticated user found');
      return { authorized: false, user: null, redirect: '/' };
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
      
      // 🚨 SECURITY ALERT: Log unauthorized access attempt
      console.log('🚨 SERVER: Logging unauthorized admin access attempt');
      await logUnauthorizedAdminAccess(profile, req);
      console.log('🚨 SERVER: Admin access logging completed');
      
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
    return { authorized: false, user: null, redirect: '/' };
  }
}

/**
 * Server-side staff check - allows both admin and staff access
 * Returns user data if admin/staff, redirects otherwise
 */
export async function checkServerSideStaff(req, res) {
  try {
    // Create authenticated supabase client
    const authHeader = req.headers.authorization || req.headers.cookie;
    if (!authHeader) {
      console.log('No auth header found in staff check');
      return { authorized: false, user: null, redirect: '/' };
    }

    const supabase = createServerSupabase(req, res);
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('No authenticated user found in staff check');
      return { authorized: false, user: null, redirect: '/' };
    }
    
    // Get user profile with admin/staff status
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, username, email, is_admin, is_staff, gizmo_id')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      console.error('Profile fetch error in staff check:', profileError);
      return { authorized: false, user: null, redirect: '/' };
    }
    
    const isAdmin = !!profile.is_admin;
    const isStaff = !!profile.is_staff;
    
    // Must have at least staff privileges
    if (!isAdmin && !isStaff) {
      console.log('User has no admin/staff privileges');
      
      // 🚨 SECURITY ALERT: Log unauthorized access attempt
      console.log('🚨 SERVER: Logging unauthorized staff access attempt');
      await logUnauthorizedStaffAccess(profile, req);
      console.log('🚨 SERVER: Staff access logging completed');
      
      return { authorized: false, user: profile, redirect: '/' };
    }
    
    return { 
      authorized: true, 
      user: { 
        ...profile, 
        isAdmin, 
        isStaff 
      } 
    };
    
  } catch (error) {
    console.error('Server-side staff check error:', error);
    return { authorized: false, user: null, redirect: '/' };
  }
}

/**
 * Higher-order function for admin pages
 * Use this in getServerSideProps for admin pages
 */
export function withServerSideAdmin(requireAdmin = false) {
  return async function getServerSideProps(context) {
    const { req, res } = context;
    
    console.log('🔍 SERVER: withServerSideAdmin called for:', req.url);
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

/**
 * Higher-order function for staff pages (allows both admin and staff)
 * Use this in getServerSideProps for staff-accessible pages
 */
export function withServerSideStaff() {
  return async function getServerSideProps(context) {
    const { req, res } = context;
    
    const authCheck = await checkServerSideStaff(req, res);
    
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
