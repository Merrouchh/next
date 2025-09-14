import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Create client with service role key to access notification_reads table
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getUserNotifications(req, res, supabase);
      default:
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ 
          success: false,
          error: 'method_not_allowed',
          message: `Method ${req.method} Not Allowed` 
        });
    }
  } catch (error) {
    console.error('User notifications API error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Internal server error' 
    });
  }
}

// Get active notifications for users
async function getUserNotifications(req, res, supabase) {
  try {
    const now = new Date().toISOString();

    // Get user from Authorization header if provided
    let userId = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
      }
    }

    // Get all active notifications: global (recipient_user_id IS NULL) + per-user
    let notificationsQuery = supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        created_at,
        expires_at,
        is_active,
        recipient_user_id,
        type,
        data
      `)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (userId) {
      notificationsQuery = notificationsQuery.or(`recipient_user_id.is.null,recipient_user_id.eq.${userId}`);
    } else {
      notificationsQuery = notificationsQuery.is('recipient_user_id', null);
    }

    const { data: notificationsData, error } = await notificationsQuery.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user notifications:', error);
      return res.status(500).json({ 
        success: false,
        error: 'database_error',
        message: 'Failed to fetch notifications'
      });
    }

    // Initialize notifications variable
    let notifications = notificationsData || [];

    // If user is authenticated, add read status to each notification
    if (userId && notifications && notifications.length > 0) {
      const notificationIds = notifications.map(n => n.id);
      
      
      const { data: readNotifications, error: readError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .in('notification_id', notificationIds);


      if (!readError && readNotifications) {
        const readIds = new Set(readNotifications.map(r => r.notification_id));
        notifications = notifications.map(n => ({
          ...n,
          isRead: readIds.has(n.id)
        }));
      } else {
        // If no read data, mark all as unread
        notifications = notifications.map(n => ({
          ...n,
          isRead: false
        }));
      }
    } else {
      // If not authenticated, mark all as unread
      notifications = notifications.map(n => ({
        ...n,
        isRead: false
      }));
    }

    
    return res.status(200).json({ 
      success: true,
      notifications: notifications || []
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Failed to fetch notifications'
    });
  }
}
