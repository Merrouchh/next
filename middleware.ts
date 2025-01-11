import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    res.headers.set('x-auth-status', 'authenticated')
    return res
  }

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
