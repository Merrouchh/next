import { createMiddlewareSupabaseClient, handleMiddlewareError } from './utils/supabase/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { logger } from './utils/logger'

export async function middleware(request: NextRequest) {
  try {
    // Log request start
    logger.info('REQUEST_START', {
      url: request.url,
      method: request.method,
      path: request.nextUrl.pathname
    });

    const { supabase, response } = createMiddlewareSupabaseClient(request)

    // Get session
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      logger.error('AUTH_ERROR', { error });
      throw error;
    }

    if (session) {
      logger.info('AUTH_SESSION', {
        userId: session.user.id,
        email: session.user.email
      });
    }

    // Log response
    logger.info('REQUEST_END', {
      url: request.url,
      status: response.status
    });

    return response;
  } catch (error) {
    return handleMiddlewareError(request, error as Error);
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
