import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ 
        success: false,
        error: 'method_not_allowed',
        message: `Method ${req.method} Not Allowed` 
      });
    }

    // Create client with service role key for server-side access
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
    
    // Verify the user and check if they're admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'forbidden',
        message: 'Admin access required'
      });
    }

    const { notification_id } = req.query;

    if (notification_id) {
      // Get read stats for a specific notification
      const { data: stats, error: statsError } = await supabase
        .rpc('get_notification_read_stats', { notification_id_param: parseInt(notification_id) });

      if (statsError) {
        console.error('Error getting notification read stats:', statsError);
        return res.status(500).json({
          success: false,
          error: 'database_error',
          message: 'Failed to get read statistics'
        });
      }

      // Get detailed read list
      const { data: readList, error: readListError } = await supabase
        .from('notification_reads')
        .select(`
          id,
          read_at,
          user_id,
          users!inner(username, email)
        `)
        .eq('notification_id', notification_id)
        .order('read_at', { ascending: false });

      if (readListError) {
        console.error('Error getting read list:', readListError);
        return res.status(500).json({
          success: false,
          error: 'database_error',
          message: 'Failed to get read list'
        });
      }

      return res.status(200).json({
        success: true,
        stats: stats[0] || { total_users: 0, read_users: 0, read_percentage: 0 },
        readList: readList || []
      });

    } else {
      // Get read stats for admin and global notifications only
      // Exclude personal notifications (likes, comments) which are between users only
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select(`
          id,
          title,
          created_at,
          expires_at,
          is_active,
          created_by,
          type
        `)
        .eq('is_active', true)
        .or('created_by.not.is.null,type.in.(event,upload)') // Admin-created OR global notifications only
        .order('created_at', { ascending: false });

      if (notificationsError) {
        console.error('Error getting notifications:', notificationsError);
        return res.status(500).json({
          success: false,
          error: 'database_error',
          message: 'Failed to get notifications'
        });
      }

      // Get stats for each notification
      const notificationsWithStats = await Promise.all(
        notifications.map(async (notification) => {
          const { data: stats, error: statsError } = await supabase
            .rpc('get_notification_read_stats', { notification_id_param: notification.id });

          if (statsError) {
            console.error(`Error getting stats for notification ${notification.id}:`, statsError);
            return {
              ...notification,
              stats: { total_users: 0, read_users: 0, read_percentage: 0 }
            };
          }

          return {
            ...notification,
            stats: stats[0] || { total_users: 0, read_users: 0, read_percentage: 0 }
          };
        })
      );

      return res.status(200).json({
        success: true,
        notifications: notificationsWithStats
      });
    }

  } catch (error) {
    console.error('Get notification read stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'internal_server_error',
      message: 'Internal server error'
    });
  }
}
