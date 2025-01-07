import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  
  // Initialize the Supabase client
  const supabase = createMiddlewareClient({ req: request, res })
  
  // Refresh the session
  try {
    await supabase.auth.getSession()
  } catch (e) {
    console.error('Auth error:', e)
  }

  // Always return the response without redirects
  return res
}

export const config = {
  matcher: [
    // Only match specific routes that need auth
    '/dashboard',
    '/chat',
    '/avcomputers'
  ]
}
