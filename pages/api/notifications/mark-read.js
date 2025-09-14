import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ 
        success: false,
        error: 'method_not_allowed',
        message: `Method ${req.method} Not Allowed` 
      });
    }

    // Create client with service role key to bypass RLS
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authorization header required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log('Mark-read API user verification:', { user: user?.id, error: authError });
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid or expired token'
      });
    }

    const { notification_id } = req.body;

    if (!notification_id) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'notification_id is required'
      });
    }

    // Check if notification exists and is active
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('id, is_active, expires_at')
      .eq('id', notification_id)
      .eq('is_active', true)
      .single();

    if (notificationError || !notification) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Notification not found or inactive'
      });
    }

    // Check if notification has expired
    if (notification.expires_at && new Date(notification.expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'expired',
        message: 'Notification has expired'
      });
    }

    // Insert read record (ignore if already exists due to UNIQUE constraint)
    console.log('Inserting read record:', { notification_id, user_id: user.id });
    
    const { error: insertError } = await supabase
      .from('notification_reads')
      .insert({
        notification_id: notification_id,
        user_id: user.id
      });

    console.log('Insert result:', { insertError });

    // If it's a duplicate key error, that's fine - user already marked it as read
    if (insertError && insertError.code !== '23505') {
      console.error('Error marking notification as read:', insertError);
      return res.status(500).json({
        success: false,
        error: 'database_error',
        message: 'Failed to mark notification as read'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Internal server error'
    });
  }
}
