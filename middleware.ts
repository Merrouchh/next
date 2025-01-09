import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Keep route protection logic here and remove from _app.js
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user is already authenticated, don't show loading screen for protected routes
  if (session) {
    // Add a custom header to indicate authenticated state
    res.headers.set('x-auth-status', 'authenticated')
    return res
  }

  // If not authenticated and trying to access protected route, redirect to home
  const protectedRoutes = ['/dashboard', '/avcomputers', '/chat', '/admin']
  if (protectedRoutes.includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard',
    '/avcomputers',
    '/chat',
    '/admin',
    '/',
  ],
}
