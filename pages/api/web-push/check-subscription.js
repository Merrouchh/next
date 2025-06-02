// API endpoint to check if a push subscription is valid in the database
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

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

    // Check if subscription exists in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Query for active subscription with this endpoint
    let query = supabase
      .from('push_subscriptions')
      .select('id, is_active, user_id, created_at')
      .eq('endpoint', endpoint)
      .eq('is_active', true);
    
    // If user is authenticated, also check user_id matches
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();

    if (error || !data) {
      console.log('❌ No active subscription found for endpoint');
      return res.status(200).json({ 
        isActive: false,
        reason: error ? error.message : 'No subscription found'
      });
    }

    console.log('✅ Active subscription found:', {
      id: data.id,
      user_id: data.user_id,
      created_at: data.created_at
    });

    res.status(200).json({ 
      isActive: true,
      subscriptionId: data.id,
      userId: data.user_id,
      createdAt: data.created_at
    });

  } catch (error) {
    console.error('❌ Error checking push subscription:', error);
    res.status(500).json({ 
      error: 'Failed to check subscription',
      details: error.message 
    });
  }
} 