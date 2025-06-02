// API endpoint to unsubscribe all push notifications for the current authenticated user
import { createClient } from '../../../utils/supabase/server-props';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create Supabase client
  const supabase = createClient({ req, res });

  // Get authenticated user
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  // Check authentication
  if (authError || !user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    console.log(`🔔 Cleaning up push subscriptions for user: ${user.id}`);

    // Deactivate all push subscriptions for this user
    const { data, error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true)
      .select('id');

    if (error) {
      console.error('Error deactivating push subscriptions:', error);
      return res.status(500).json({ 
        error: 'Failed to cleanup push subscriptions',
        details: error.message 
      });
    }

    const cleanedCount = data?.length || 0;
    console.log(`✅ Successfully deactivated ${cleanedCount} push subscriptions for user ${user.id}`);

    res.status(200).json({ 
      success: true, 
      message: 'All push subscriptions cleaned up successfully',
      cleanedCount,
      userId: user.id
    });

  } catch (error) {
    console.error('❌ Error cleaning up push subscriptions:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup push subscriptions',
      details: error.message 
    });
  }
} 