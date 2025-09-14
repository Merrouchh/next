import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Create authenticated client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'not_authenticated',
        message: 'Authentication required' 
      });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return res.status(403).json({ 
        success: false,
        error: 'forbidden',
        message: 'Admin access required' 
      });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getNotifications(req, res, supabase);
      case 'POST':
        return await createNotification(req, res, supabase, user);
      case 'PUT':
        return await updateNotification(req, res, supabase);
      case 'DELETE':
        return await deleteNotification(req, res, supabase);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ 
          success: false,
          error: 'method_not_allowed',
          message: `Method ${req.method} Not Allowed` 
        });
    }
  } catch (error) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Internal server error' 
    });
  }
}

// Get all notifications
async function getNotifications(req, res, supabase) {
  try {
    // Only show admin-created notifications and global notifications (events, uploads)
    // Exclude personal notifications (likes, comments) which are between users only
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        is_active,
        created_at,
        updated_at,
        expires_at,
        created_by,
        type,
        recipient_user_id
      `)
      .or('created_by.not.is.null,type.in.(event,upload)') // Admin-created OR global notifications only (exclude personal like/comment notifications)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ 
        success: false,
        error: 'database_error',
        message: 'Failed to fetch notifications' 
      });
    }

    return res.status(200).json({ 
      success: true,
      notifications: notifications || []
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Failed to fetch notifications' 
    });
  }
}

// Create a new notification
async function createNotification(req, res, supabase, adminUser) {
  try {
    const { title, message, expires_at } = req.body;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Title and message are required' 
      });
    }

    // Validate title length
    if (title.length > 255) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Title must be 255 characters or less' 
      });
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        title: title.trim(),
        message: message.trim(),
        created_by: adminUser.id,
        expires_at: expires_at || null
      })
      .select(`
        id,
        title,
        message,
        is_active,
        created_at,
        expires_at
      `)
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return res.status(500).json({ 
        success: false,
        error: 'database_error',
        message: 'Failed to create notification' 
      });
    }

    return res.status(201).json({ 
      success: true,
      notification,
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Create notification error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Failed to create notification' 
    });
  }
}

// Update a notification
async function updateNotification(req, res, supabase) {
  try {
    const { id, title, message, is_active, expires_at } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Notification ID is required' 
      });
    }

    // Validate title and message if provided
    if (title !== undefined && (!title || title.length > 255)) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Title must be provided and 255 characters or less' 
      });
    }

    if (message !== undefined && !message) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Message is required' 
      });
    }

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title.trim();
    if (message !== undefined) updateData.message = message.trim();
    if (is_active !== undefined) updateData.is_active = is_active;
    if (expires_at !== undefined) updateData.expires_at = expires_at;

    // Update notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        title,
        message,
        is_active,
        created_at,
        updated_at,
        expires_at
      `)
      .single();

    if (error) {
      console.error('Error updating notification:', error);
      return res.status(500).json({ 
        success: false,
        error: 'database_error',
        message: 'Failed to update notification' 
      });
    }

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        error: 'not_found',
        message: 'Notification not found' 
      });
    }

    return res.status(200).json({ 
      success: true,
      notification,
      message: 'Notification updated successfully' 
    });
  } catch (error) {
    console.error('Update notification error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Failed to update notification' 
    });
  }
}

// Delete a notification
async function deleteNotification(req, res, supabase) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'validation_error',
        message: 'Notification ID is required' 
      });
    }

    // Delete notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      return res.status(500).json({ 
        success: false,
        error: 'database_error',
        message: 'Failed to delete notification' 
      });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Notification deleted successfully' 
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'internal_server_error',
      message: 'Failed to delete notification' 
    });
  }
}
