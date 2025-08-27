import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Helper function to check if already on auth page
const isAuthPage = (pathname: string): boolean => {
  return pathname.startsWith('/auth/verification-') || 
         pathname === '/auth/confirm' || 
         pathname === '/auth/callback' ||
         pathname === '/auth/reset-password';
}

// Helper function to create a URL with error parameters
const createErrorRedirectUrl = (request: NextRequest, errorCode: string, errorDesc: string): URL => {
  const url = new URL(
    `/auth/verification-failed?error_code=${encodeURIComponent(errorCode)}&error_description=${encodeURIComponent(errorDesc)}`, 
    request.url
  );
  return url;
}

// Helper function to handle auth redirects based on token type
const getAuthRedirectPath = (searchParams: URLSearchParams): string => {
  const hasTokenHash = searchParams.has('token_hash');
  const hasToken = searchParams.has('token');
  const hasCode = searchParams.has('code');
  const type = searchParams.get('type') || 'email_change';
  const redirect_to = searchParams.get('redirect_to') || '';

  // Special handling for magic links
  if (type === 'magiclink' || type === 'recovery') {
    console.log('Magic link detected');
    // For password recovery, redirect to reset password page
    if (type === 'recovery') {
      return '/auth/reset-password';
    }
    // For all other magic links, prefer our dedicated /magic-login handler if possible
    // If token is in params, use the API endpoint
    if (hasToken) {
      let apiPath = `/api/auth/magic-link?token=${searchParams.get('token')}&type=${type}`;
      if (redirect_to) {
        apiPath += `&redirect_to=${encodeURIComponent(redirect_to)}`;
      }
      return apiPath;
    }
    // No token in URL, assume it will be in hash fragment
    return '/magic-login';
  }

  if (hasTokenHash) {
    return `/auth/confirm?token_hash=${searchParams.get('token_hash')}&type=${type}`;
  } else if (hasToken) {
    return `/auth/callback?token=${searchParams.get('token')}&type=${type}`;
  } else if (hasCode) {
    return `/auth/callback?code=${searchParams.get('code')}`;
  }

  return '/auth/callback';
}

export async function middleware(request: NextRequest) {
  // Parse URL components once
  const url = new URL(request.url);
  const { pathname, search, hash } = url;
  const searchParams = url.searchParams;

  // Skip logging for static assets to reduce noise
      if (!pathname.startsWith('/_next') && !pathname.includes('.')) {
    console.log('Middleware processing URL:', { pathname, search, hash });
  }

  // Special handling for URLs with hash fragments that might contain magic link tokens
  // Unfortunately, hash fragments are not sent to the server
  // But we can check if the URL has a hash in the logs, which might indicate a magic link

  // Skip middleware processing for auth pages
  if (isAuthPage(pathname)) {
    console.log('Already on auth page, no redirect needed');
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  // Check for various Supabase auth parameters
  const hasTokenHash = searchParams.has('token_hash');
  const hasType = searchParams.has('type');
  const hasToken = searchParams.has('token');
  const hasCode = searchParams.has('code');
  const hasError = searchParams.has('error') || searchParams.has('error_code') || searchParams.has('error_description');
  const hasAccessToken = hash.includes('access_token');
  const type = searchParams.get('type');
  
  // Add special detection for magic links
  const isMagicLink = type === 'magiclink' || type === 'recovery';
  
  // Check if this is an auth redirect
  const isAuthRedirect = hasTokenHash || (hasToken && (hasType || isMagicLink)) || hasCode;
  
  // Handle error parameters - highest priority
  if (hasError && (pathname === '/' || pathname === '/auth/callback')) {
    console.log('Middleware detected auth error in URL, redirecting to failure page');
    
    // Collect error details
    const errorCode = searchParams.get('error_code') || '';
    const errorDesc = searchParams.get('error_description') || 'Verification failed';
    
    // Create redirect URL with error details
    const redirectUrl = createErrorRedirectUrl(request, errorCode, errorDesc);
    
    console.log('Redirecting to verification failed:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);
  }
  
  // Handle verification redirects - second priority
  if (isAuthRedirect) {
    console.log('Middleware detected auth redirect with token_hash, token, or code');
    
    // Get the appropriate redirect path
    const redirectPath = getAuthRedirectPath(searchParams);
    
    console.log('Redirecting to:', redirectPath);
    const redirectUrl = new URL(redirectPath, request.url);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Handle hash-based redirects and errors - third priority
  if (pathname === '/' && hash) {
    if (hash.includes('error=') || hash.includes('error_code=')) {
      console.log('Middleware detected auth error in URL hash');
      
      // Extract error details from hash
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      const errorCode = hashParams.get('error_code') || '';
      const errorDesc = hashParams.get('error_description') || 'Verification failed';
      
      // Create redirect URL with error details
      const redirectUrl = createErrorRedirectUrl(request, errorCode, errorDesc);
      
      console.log('Redirecting to verification failed from hash:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    } else if (hasAccessToken) {
      // For magic links with hash fragments, redirect to our dedicated handler
      if (hash.includes('type=magiclink')) {
        console.log('Middleware detected magic link hash - redirecting to dedicated handler');
        // Redirect directly to our magic-login handler
        const redirectUrl = new URL('/magic-login', request.url);
        return NextResponse.redirect(redirectUrl);
      }
      
      console.log('Middleware detected hash-based auth redirect');
      const redirectUrl = new URL('/auth/callback', request.url);
      // We can't forward the hash directly, but the callback page will read it from window.location
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Continue with normal request processing
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Initialize Supabase server client using server-side env vars
  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieStore = request.cookies;
          return [...cookieStore.getAll()].map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          })
        },
      },
    }
  )

  // Get session here but don't wait for it
  try {
    await supabase.auth.getSession();
  } catch (error) {
    console.error('Error in middleware session check:', error);
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 