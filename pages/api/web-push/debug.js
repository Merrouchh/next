// Debug endpoint to show push subscriptions for current user
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user ID from authentication
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (user && !error) {
          userId = user.id;
        }
      } catch (error) {
        console.error('Error getting user from token:', error);
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get all subscriptions for this user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, subscription_id, endpoint, is_active, created_at, updated_at, user_agent')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch subscriptions',
        details: error.message 
      });
    }

    res.status(200).json({ 
      userId,
      subscriptions: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Error in debug endpoint:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed',
      details: error.message 
    });
  }
} 