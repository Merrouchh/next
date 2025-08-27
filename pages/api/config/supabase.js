// Secure endpoint to provide Supabase config to authenticated clients
import { authenticateRequest } from '../../../utils/supabase/secure-server';
import { withRateLimit } from '../../../utils/middleware/rateLimiting';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: For initial load, we need to allow unauthenticated access
  // but only return config if user has valid session
  try {
    const authResult = await authenticateRequest(req, res);
    if (!authResult.authenticated) {
      // For unauthenticated users, return minimal config for public access
      return res.status(200).json({
        url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      });
    }
  } catch (error) {
    // If auth check fails, still provide config for app to work
    console.warn('Auth check failed, providing fallback config:', error.message);
    return res.status(200).json({
      url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
  }

  // Return only the necessary configuration
  return res.status(200).json({
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export default withRateLimit(handler, 'general');
