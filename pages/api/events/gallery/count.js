import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a simple Supabase client
function getSupabaseClient(headers = {}) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: headers
    },
    db: {
      schema: 'public'
    }
  });
}

export default async function handler(req, res) {
  const { method } = req;
  
  // Only accept GET requests
  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set response headers to prevent caching
      // Cache headers removed

  const { eventId } = req.query;
  
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  try {
    // Initialize Supabase client with request headers
    const headers = {
      Authorization: req.headers.authorization,
      Cookie: req.headers.cookie
    };
    const supabase = getSupabaseClient(headers);
    
    // Get only the count of images for this event
    const { count, error } = await supabase
      .from('event_gallery')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);
      
    if (error) {
      console.error('Error fetching gallery count:', error);
      return res.status(500).json({ error: 'Failed to fetch gallery count' });
    }
    
    // Return just the count
    return res.status(200).json({ count: count || 0 });
    
  } catch (error) {
    console.error('Error in gallery count handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 