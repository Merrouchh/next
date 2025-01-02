import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res })
  const { data: { session } } = await supabase.auth.getSession()
  const path = request.nextUrl.pathname

  console.log(`Middleware Check - Path: ${path}, Auth: ${!!session}`)

  if (session) {
    // User is authenticated
    if (path === '/') {
      // Only redirect to dashboard from home page
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // Allow access to all other routes when authenticated
    return res
  }

  // Not authenticated
  if (path !== '/') {
    // Redirect to home page (which has login) if trying to access any other route
    return NextResponse.redirect(new URL('/', request.url))
  }

  return res
}

export const config = {
  matcher: ['/', '/dashboard', '/avcomputers']
}
