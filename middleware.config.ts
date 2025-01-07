import { createMiddlewareSupabaseClient } from './utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from './utils/logger'

export async function middleware(request: NextRequest) {
  try {
    const { supabase, response } = createMiddlewareSupabaseClient(request)

    // Check auth status
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Get URL info
    const requestUrl = new URL(request.url)
    const protectedRoutes = ['/dashboard', '/chat', '/avcomputers']

    // Check if route requires auth
    if (protectedRoutes.includes(requestUrl.pathname)) {
      if (!session) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    return response

  } catch (error) {
    logger.error('Middleware error:', error)
    // Return to home page on error
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: ['/dashboard', '/chat', '/avcomputers']
}
