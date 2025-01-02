import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// Add logging utility
const logMiddleware = (request: NextRequest, type: string, details: any) => {
  const timestamp = new Date().toISOString();
  const url = request.url;
  const method = request.method;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  console.log(JSON.stringify({
    timestamp,
    type,
    url,
    method,
    userAgent,
    details
  }, null, 2));
}

export function createMiddlewareSupabaseClient(request: NextRequest) {
  const response = NextResponse.next()
  
  // Log incoming request
  logMiddleware(request, 'REQUEST_START', {
    path: request.nextUrl.pathname,
    search: request.nextUrl.search
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name)?.value;
          // Log cookie access
          logMiddleware(request, 'COOKIE_ACCESS', { name, exists: !!cookie });
          return cookie;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Log cookie set
          logMiddleware(request, 'COOKIE_SET', { name, options });
          response.cookies.set({
            name,
            value,
            ...options,
            sameSite: 'lax',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 365, // 1 year
          })
        },
        remove(name: string, options: CookieOptions) {
          // Log cookie removal
          logMiddleware(request, 'COOKIE_REMOVE', { name, options });
          response.cookies.delete({
            name,
            ...options,
            path: '/'
          })
        },
      },
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        flowType: 'pkce'
      }
    }
  )

  return { supabase, response }
}

// Optional: Add middleware to log errors
export function handleMiddlewareError(request: NextRequest, error: Error) {
  logMiddleware(request, 'MIDDLEWARE_ERROR', {
    error: error.message,
    stack: error.stack
  });
  
  return NextResponse.redirect(new URL('/error', request.url));
}