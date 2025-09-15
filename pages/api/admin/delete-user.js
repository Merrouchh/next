import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify admin access
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (userError || !userData || !userData.is_admin) {
    throw new Error('Admin access required');
  }

  return user;
}

export default async function handler(req, res) {
  try {
    console.log('Delete user API called:', { method: req.method, url: req.url, body: req.body });
    
    if (req.method !== 'DELETE') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    await verifyAdmin(req.headers.authorization);
    console.log('Admin verification passed');
    
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    console.log('Deleting user with ID:', userId);

    // First, get user info for logging
    const { data: userToDelete, error: userError } = await supabase
      .from('users')
      .select('id, username, email, gizmo_id')
      .eq('id', userId)
      .single();

    if (userError || !userToDelete) {
      console.log('User not found:', userError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('User to delete:', userToDelete);

    // Delete user's clips first (due to foreign key constraints)
    const { error: clipsError } = await supabase
      .from('clips')
      .delete()
      .eq('user_id', userId);

    if (clipsError) {
      console.error('Error deleting user clips:', clipsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user clips',
        details: clipsError.message
      });
    }

    console.log('User clips deleted successfully');

    // Delete user's comments
    const { error: commentsError } = await supabase
      .from('clip_comments')
      .delete()
      .eq('user_id', userId);

    if (commentsError) {
      console.error('Error deleting user comments:', commentsError);
      // Continue with user deletion even if comments fail
    } else {
      console.log('User comments deleted successfully');
    }

    // Delete user's likes from video_likes table
    const { error: likesError } = await supabase
      .from('video_likes')
      .delete()
      .eq('user_id', userId);

    if (likesError) {
      console.error('Error deleting user likes:', likesError);
      // Continue with user deletion even if likes fail
    } else {
      console.log('User likes deleted successfully');
    }

    // Delete user's queue entries
    const { error: queueError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('user_id', userId);

    if (queueError) {
      console.error('Error deleting user queue entries:', queueError);
      // Continue with user deletion even if queue entries fail
    } else {
      console.log('User queue entries deleted successfully');
    }

    // Delete user's achievements
    const { error: achievementsError } = await supabase
      .from('user_achievements')
      .delete()
      .eq('user_id', userId);

    if (achievementsError) {
      console.error('Error deleting user achievements:', achievementsError);
      // Continue with user deletion even if achievements fail
    } else {
      console.log('User achievements deleted successfully');
    }

    // Delete user's game time rewards
    const { error: gameTimeRewardsError } = await supabase
      .from('game_time_rewards')
      .delete()
      .eq('user_id', userId);

    if (gameTimeRewardsError) {
      console.error('Error deleting user game time rewards:', gameTimeRewardsError);
      // Continue with user deletion even if game time rewards fail
    } else {
      console.log('User game time rewards deleted successfully');
    }

    // Delete user's notifications
    const { error: notificationsError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (notificationsError) {
      console.error('Error deleting user notifications:', notificationsError);
      // Continue with user deletion even if notifications fail
    } else {
      console.log('User notifications deleted successfully');
    }

    // Delete user's event registrations
    const { error: eventRegistrationsError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('user_id', userId);

    if (eventRegistrationsError) {
      console.error('Error deleting user event registrations:', eventRegistrationsError);
      // Continue with user deletion even if event registrations fail
    } else {
      console.log('User event registrations deleted successfully');
    }

    // Finally, delete the user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        details: deleteError.message
      });
    }

    console.log('User deleted successfully:', userToDelete.username);

    return res.status(200).json({
      success: true,
      message: `User "${userToDelete.username}" deleted successfully`,
      deletedUser: {
        id: userToDelete.id,
        username: userToDelete.username,
        email: userToDelete.email,
        gizmo_id: userToDelete.gizmo_id
      }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    console.error('Error stack:', error.stack);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
