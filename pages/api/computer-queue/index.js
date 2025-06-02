import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Initialize Supabase with service role key for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Handle different HTTP methods
  switch (req.method) {
    case 'GET':
      // Check if this is a status check request
      if (req.query.check_status === 'true') {
        return checkUserQueueStatus(req, res, supabase);
      }
      return getQueue(req, res, supabase);
    case 'POST':
      return addToQueue(req, res, supabase);
    case 'DELETE':
      return removeFromQueue(req, res, supabase);
    case 'PUT':
      return updateQueue(req, res, supabase);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PUT']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Check if user is already in queue
async function checkUserQueueStatus(req, res, supabase) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(200).json({ in_queue: false });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(200).json({ in_queue: false });
    }

    // Check if user is in queue
    const { data: queueEntry } = await supabase
      .from('computer_queue')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (queueEntry) {
      const formatComputerType = (type) => {
        switch (type) {
          case 'normal': return 'Normal PC';
          case 'vip': return 'VIP PC';
          case 'any': return 'Any PC';
          default: return type;
        }
      };

      return res.status(200).json({ 
        in_queue: true,
        entry: queueEntry,
        position: queueEntry.position,
        message: `You are #${queueEntry.position} in line for ${formatComputerType(queueEntry.computer_type)}`
      });
    }

    return res.status(200).json({ in_queue: false });
  } catch (error) {
    console.error('Error in checkUserQueueStatus:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get current queue
async function getQueue(req, res, supabase) {
  try {
    // Check if this is a request for just the count (public)
    const { count_only } = req.query;
    
    if (count_only === 'true') {
      // Public endpoint - return count by computer type for smart blocking
      const { data: queueData, error } = await supabase
        .from('computer_queue')
        .select('computer_type')
        .order('position', { ascending: true });

      if (error) {
        console.error('Error fetching queue count:', error);
        return res.status(500).json({ error: 'Failed to fetch queue count' });
      }

      // Group by computer type for smart conflict detection
      const queueByType = {
        normal: queueData?.filter(q => q.computer_type === 'normal').length || 0,
        vip: queueData?.filter(q => q.computer_type === 'vip').length || 0,
        any: queueData?.filter(q => q.computer_type === 'any').length || 0,
        total: queueData?.length || 0
      };

      return res.status(200).json({ 
        queue: Array(queueByType.total).fill({}), // Keep backward compatibility
        queueByType // Add new detailed info
      });
    }

    // Admin request - full queue details (requires auth)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { data: queue, error } = await supabase
      .from('computer_queue')
      .select('*')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching queue:', error);
      return res.status(500).json({ error: 'Failed to fetch queue' });
    }

    // Clean up stale position entries
    await cleanupStalePositions(supabase);

    return res.status(200).json({ queue });
  } catch (error) {
    console.error('Error in getQueue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Add someone to the queue
async function addToQueue(req, res, supabase) {
  try {
    const { user_name, phone_number, computer_type, notes, self_service, user_id } = req.body;

    if (!user_name || !computer_type) {
      return res.status(400).json({ error: 'User name and computer type are required' });
    }

    // Validate computer_type
    if (!['normal', 'vip', 'any'].includes(computer_type)) {
      return res.status(400).json({ error: 'Invalid computer type' });
    }

    let created_by = null;
    let authenticatedUserId = null;

    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      // For self-service, no auth required
      if (!self_service) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      // Validate the token if provided
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        if (!self_service) {
          return res.status(401).json({ error: 'Invalid authentication' });
        }
      } else {
        created_by = user.id;
        authenticatedUserId = user.id;
        
        // If not self-service, check admin privileges
        if (!self_service) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (userError || !userData?.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
          }
        }
      }
    }

    // For self-service, validate required fields are present
    if (self_service && !phone_number) {
      return res.status(400).json({ error: 'Phone number is required for self-service queue registration' });
    }

    // Check for existing entries to prevent duplicates
    const targetUserId = self_service ? authenticatedUserId : user_id;
    
    // Check by user_id if available (for both self-service and admin-added existing users)
    if (targetUserId) {
      const { data: existingByUserId } = await supabase
        .from('computer_queue')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (existingByUserId) {
        const errorMessage = self_service 
          ? `You are already in the queue at position #${existingByUserId.position}`
          : `This user is already in the queue at position #${existingByUserId.position}`;
        
        return res.status(409).json({ 
          error: errorMessage,
          existing_entry: existingByUserId,
          is_duplicate: true
        });
      }
    }
    
    // Also check by phone number for additional safety
    if (phone_number) {
      const { data: existingByPhone } = await supabase
        .from('computer_queue')
        .select('*')
        .eq('phone_number', phone_number)
        .single();

      if (existingByPhone) {
        const errorMessage = self_service 
          ? `This phone number is already in the queue at position #${existingByPhone.position}`
          : `This phone number is already in the queue at position #${existingByPhone.position}`;
        
        return res.status(409).json({ 
          error: errorMessage,
          existing_entry: existingByPhone,
          is_duplicate: true
        });
      }
    }

    // Get next position
    const { data: nextPosition, error: positionError } = await supabase
      .rpc('get_next_queue_position');

    if (positionError) {
      console.error('Error getting next position:', positionError);
      return res.status(500).json({ error: 'Failed to determine queue position' });
    }

    // Add to queue
    const { data: newEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert([{
        user_name,
        phone_number,
        computer_type,
        notes: self_service ? (notes || 'Remote queue registration') : notes,
        position: nextPosition,
        user_id: self_service ? authenticatedUserId : user_id, // Use provided user_id for admin-added existing users
        created_by
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error adding to queue:', insertError);
      return res.status(500).json({ error: 'Failed to add to queue' });
    }

    const formatComputerType = (type) => {
      switch (type) {
        case 'normal': return 'Normal PC';
        case 'vip': return 'VIP PC';
        case 'any': return 'Any PC';
        default: return type;
      }
    };

    // Update user position tracking table for queue position monitoring
    if (newEntry.user_id) {
      try {
        await supabase
          .from('user_queue_positions')
          .upsert({
            user_id: newEntry.user_id,
            position: nextPosition,
            computer_type: computer_type
          });
        console.log(`✅ Updated position tracking for user ${newEntry.user_id}: position ${nextPosition}`);
      } catch (error) {
        console.error('Error updating user position tracking:', error);
      }

      // Trigger web push notification for the new user joining queue
      const affectedUsers = [{
        userId: newEntry.user_id,
        currentPosition: nextPosition,
        computerType: computer_type,
        action: 'joined'
      }];
      
      // Don't await this to avoid blocking the response
      triggerWebPushNotifications(supabase, affectedUsers).catch(error => {
        console.error('Error triggering join notification:', error);
      });
    }

    return res.status(201).json({ 
      entry: newEntry,
      position: nextPosition,
      message: self_service 
        ? `Successfully joined the queue! You are #${nextPosition} in line for ${formatComputerType(computer_type)}.`
        : 'Added to queue successfully'
    });
  } catch (error) {
    console.error('Error in addToQueue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Remove someone from the queue
async function removeFromQueue(req, res, supabase) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { id, self_remove } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Queue entry ID is required' });
    }

    // Check if this is a self-removal request
    if (self_remove === 'true') {
      // User can only remove their own queue entry
      const { data: queueEntry } = await supabase
        .from('computer_queue')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!queueEntry || queueEntry.user_id !== user.id) {
        return res.status(403).json({ error: 'You can only remove your own queue entry' });
      }
    } else {
      // Admin removal - check admin privileges
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (userError || !userData?.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    // Get the queue entry before deletion to know which user is leaving
    const { data: removedEntry } = await supabase
      .from('computer_queue')
      .select('user_id, position, computer_type')
      .eq('id', id)
      .single();

    if (!removedEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    // Debug: Get full queue state before removal
    const { data: fullQueueBefore, error: fullQueueError } = await supabase
      .from('computer_queue')
      .select('id, user_id, position, computer_type, user_name')
      .order('position', { ascending: true });

    if (fullQueueError) {
      console.error('Error fetching full queue for debugging:', fullQueueError);
    } else {
      console.log('🔍 Full queue before removal:', fullQueueBefore?.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        userName: entry.user_name,
        position: entry.position,
        computerType: entry.computer_type,
        isGuest: !entry.user_id
      })));
    }

    // IMPORTANT: Get affected entries BEFORE deletion
    const { data: affectedEntries, error: affectedError } = await supabase
      .from('computer_queue')
      .select('id, user_id, position, computer_type')
      .gt('position', removedEntry.position)
      .order('position', { ascending: true });

    if (affectedError) {
      console.error('Error fetching affected entries:', affectedError);
      return res.status(500).json({ error: 'Failed to process queue updates' });
    }

    console.log('🔍 Query for affected entries (BEFORE deletion):', {
      query: `position > ${removedEntry.position}`,
      foundEntries: affectedEntries?.length || 0,
      entries: affectedEntries?.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        currentPosition: entry.position,
        willMoveTo: removedEntry.position + (affectedEntries.indexOf(entry))
      }))
    });

    // Delete from main queue table
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return res.status(500).json({ error: 'Failed to remove from queue' });
    }

    // Clean up the position tracking table for the removed user
    if (removedEntry.user_id) {
      const { error: trackingError } = await supabase
        .from('user_queue_positions')
        .delete()
        .eq('user_id', removedEntry.user_id);

      if (trackingError) {
        console.error('Error cleaning up position tracking:', trackingError);
      } else {
        console.log('✅ Cleaned up position tracking for user:', removedEntry.user_id);
      }
    }

    // After removing someone, get all users who were behind them (they move up)
    console.log('🔍 Queue removal - Initial state:', {
      removedUser: {
        id: removedEntry.user_id,
        position: removedEntry.position,
        computerType: removedEntry.computer_type,
        selfRemove: self_remove === 'true'
      }
    });

    // Debug: Check what remains in queue after deletion
    const { data: remainingQueue, error: remainingError } = await supabase
      .from('computer_queue')
      .select('id, user_id, position, computer_type, user_name')
      .order('position', { ascending: true });

    if (remainingError) {
      console.error('Error fetching remaining queue:', remainingError);
    } else {
      console.log('🔍 Queue after removal:', remainingQueue?.map(entry => ({
        id: entry.id,
        userId: entry.user_id,
        userName: entry.user_name,
        position: entry.position,
        computerType: entry.computer_type,
        isGuest: !entry.user_id
      })));
    }

    console.log('🔍 Users affected by removal:', {
      count: affectedEntries?.length || 0,
      users: affectedEntries?.map(entry => ({
        id: entry.user_id,
        oldPosition: entry.position,
        newPosition: removedEntry.position + (affectedEntries.indexOf(entry))
      }))
    });

    let notificationsSent = {
      leftQueue: false,
      positionUpdates: 0
    };

    // Send "left queue" notification to the user who left (if they didn't remove themselves)
    if (removedEntry.user_id && self_remove !== 'true') {
      try {
        const leftNotification = [{
          userId: removedEntry.user_id,
          currentPosition: 0,
          computerType: removedEntry.computer_type,
          action: 'left'
        }];
        
        await triggerWebPushNotifications(supabase, leftNotification);
        notificationsSent.leftQueue = true;
        console.log('✅ Sent left queue notification to:', removedEntry.user_id);
      } catch (error) {
        console.error('❌ Error triggering left queue notification:', error);
      }
    }

    if (affectedEntries && affectedEntries.length > 0) {
      // Update positions in both queue and tracking tables
      const updatePromises = affectedEntries.map((entry, index) => {
        const newPosition = removedEntry.position + index;
        console.log(`🔄 Processing position update: User ${entry.user_id} moving from ${entry.position} to ${newPosition}`);
        
        return Promise.all([
          // Update main queue
          supabase
            .from('computer_queue')
            .update({ 
              position: newPosition,
              updated_at: new Date().toISOString()
            })
            .eq('id', entry.id),
          
          // Update position tracking
          supabase
            .from('user_queue_positions')
            .upsert({
              user_id: entry.user_id,
              position: newPosition,
              computer_type: entry.computer_type,
              updated_at: new Date().toISOString()
            })
        ]);
      });

      try {
        // Wait for all position updates to complete
        await Promise.all(updatePromises);
        console.log('✅ All position updates completed');

        // Now that positions are updated, prepare notification data
        const affectedUsers = affectedEntries.map((entry, index) => {
          const newPosition = removedEntry.position + index;
          return {
            userId: entry.user_id,
            currentPosition: newPosition,
            previousPosition: entry.position,
            computerType: entry.computer_type,
            action: 'position_improved'
          };
        });

        // Send notifications for position improvements
        await triggerWebPushNotifications(supabase, affectedUsers);
        notificationsSent.positionUpdates = affectedUsers.length;
        
        console.log('📊 Notification summary:', {
          removedUserId: removedEntry.user_id,
          leftQueueNotification: notificationsSent.leftQueue,
          positionUpdatesSent: notificationsSent.positionUpdates,
          affectedUsers: affectedUsers.map(u => ({
            userId: u.userId,
            from: u.previousPosition,
            to: u.currentPosition
          }))
        });

      } catch (error) {
        console.error('❌ Error in position updates or notifications:', error);
      }
    }

    return res.status(200).json({ 
      message: self_remove === 'true' ? 'You have been removed from the queue' : 'Removed from queue successfully',
      affectedCount: affectedEntries?.length || 0,
      notificationsSent
    });
  } catch (error) {
    console.error('Error in removeFromQueue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update queue (reorder)
async function updateQueue(req, res, supabase) {
  try {
    // Check if user is admin
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { queue } = req.body;

    if (!Array.isArray(queue)) {
      return res.status(400).json({ error: 'Queue must be an array' });
    }

    // Get current queue state before update to detect changes
    const { data: currentQueue, error: currentQueueError } = await supabase
      .from('computer_queue')
      .select('id, user_id, position, computer_type')
      .order('position', { ascending: true });

    if (currentQueueError) {
      console.error('Error fetching current queue:', currentQueueError);
      return res.status(500).json({ error: 'Failed to fetch current queue state' });
    }

    // Create a map of current positions
    const currentPositions = new Map();
    if (currentQueue) {
      currentQueue.forEach(entry => {
        currentPositions.set(entry.id, {
          position: entry.position,
          userId: entry.user_id,
          computerType: entry.computer_type
        });
      });
    }

    // Update positions in both queue and tracking tables
    const updatePromises = queue.map((entry, index) => {
      const newPosition = index + 1;
      const oldData = currentPositions.get(entry.id);
      
      // Skip if no change in position
      if (oldData && oldData.position === newPosition) {
        return null;
      }

      return Promise.all([
        // Update main queue
        supabase
          .from('computer_queue')
          .update({ 
            position: newPosition,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id),
        
        // Update position tracking if user_id exists
        entry.user_id ? 
          supabase
            .from('user_queue_positions')
            .upsert({
              user_id: entry.user_id,
              position: newPosition,
              computer_type: entry.computer_type || 'normal'
            }) : 
          Promise.resolve()
      ]);
    }).filter(Boolean); // Remove null promises

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Prepare notification data for affected users
    const affectedUsers = queue
      .map((entry, index) => {
        const newPosition = index + 1;
        const oldData = currentPositions.get(entry.id);
        
        // Only notify if position changed and user_id exists
        if (entry.user_id && oldData && oldData.position !== newPosition) {
          return {
            userId: entry.user_id,
            currentPosition: newPosition,
            computerType: entry.computer_type || oldData.computerType || 'normal',
            action: 'position_change'
          };
        }
        return null;
      })
      .filter(Boolean); // Remove null entries

    // Send notifications for all affected users
    if (affectedUsers.length > 0) {
      try {
        await triggerWebPushNotifications(supabase, affectedUsers);
      } catch (error) {
        console.error('Error triggering queue reorder notifications:', error);
        // Don't fail the request, but log the error
      }
    }

    return res.status(200).json({ 
      message: 'Queue updated successfully',
      affectedCount: affectedUsers.length
    });
  } catch (error) {
    console.error('Error in updateQueue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to trigger web push notifications for affected users
async function triggerWebPushNotifications(supabase, affectedUsers = []) {
  // Don't trigger notifications if no users are affected
  if (!affectedUsers || affectedUsers.length === 0) {
    console.log('ℹ️ No users to notify');
    return;
  }

  try {
    console.log('🔔 Processing notifications for users:', affectedUsers.map(u => ({
      userId: u.userId,
      action: u.action,
      isGuest: !u.userId,
      position: {
        current: u.currentPosition,
        previous: u.previousPosition
      }
    })));
    
    // Import web push utilities
    const webpush = require('web-push');
    
    // Configure web-push with VAPID keys
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@merrouchgaming.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Process each affected user
    const notificationPromises = affectedUsers.map(async (userUpdate) => {
      try {
        // Skip if no userId (guest user)
        if (!userUpdate.userId) {
          console.log(`ℹ️ Skipping notifications for guest user in position ${userUpdate.currentPosition}`);
          return;
        }

        console.log(`🔍 Processing notifications for registered user ${userUpdate.userId}`);
        
        // Get user's push subscriptions directly from Supabase
        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', userUpdate.userId)
          .eq('is_active', true);

        if (subError) {
          console.error(`❌ Error fetching subscriptions for user ${userUpdate.userId}:`, subError);
          return;
        }

        if (!subscriptions || subscriptions.length === 0) {
          console.log(`ℹ️ No active push subscriptions for registered user ${userUpdate.userId} - they might not have enabled notifications`);
          return;
        }

        console.log(`📱 Found ${subscriptions.length} active subscriptions for user ${userUpdate.userId}`);

        // Create notification based on action and position
        let title = '';
        let body = '';
        let notificationTag = '';
        
        if (userUpdate.action === 'joined') {
          title = '🎮 Joined Queue';
          body = `You joined the ${userUpdate.computerType.toUpperCase()} computer queue at position ${userUpdate.currentPosition}`;
          notificationTag = 'queue-joined';
        } else if (userUpdate.action === 'left') {
          title = '👋 Left Queue';
          body = `You left the ${userUpdate.computerType.toUpperCase()} computer queue`;
          notificationTag = 'queue-left';
        } else if (userUpdate.currentPosition === 1) {
          title = '🎉 Your Turn!';
          body = `You're next in line for the ${userUpdate.computerType.toUpperCase()} computer!`;
          notificationTag = 'queue-next';
        } else if (userUpdate.action === 'position_improved') {
          title = '⬆️ Queue Position Improved!';
          body = `Someone left the queue! You moved from position #${userUpdate.previousPosition} to #${userUpdate.currentPosition} for ${userUpdate.computerType.toUpperCase()} computer.`;
          notificationTag = 'queue-improved';
        } else {
          title = '📍 Queue Position Updated';
          body = `Your position in the ${userUpdate.computerType.toUpperCase()} queue has been updated. You're now #${userUpdate.currentPosition} in line.`;
          notificationTag = 'queue-changed';
        }

        console.log(`📝 Sending notification to registered user ${userUpdate.userId}:`, {
          title,
          body,
          tag: notificationTag,
          subscriptionCount: subscriptions.length
        });

        if (title && body) {
          const payload = JSON.stringify({
            title,
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: notificationTag,
            data: {
              type: 'queue-update',
              position: userUpdate.currentPosition,
              previousPosition: userUpdate.previousPosition,
              computerType: userUpdate.computerType,
              userId: userUpdate.userId,
              timestamp: Date.now(),
              url: '/avcomputers'
            },
            actions: [
              {
                action: 'open',
                title: 'View Queue',
                icon: '/icons/action-icon-open.png'
              }
            ]
          });

          // Send to all user's subscriptions
          const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh_key,
                  auth: sub.auth_key
                }
              };

              return webpush.sendNotification(pushSubscription, payload);
            })
          );

          const successful = results.filter(result => result.status === 'fulfilled').length;
          const failed = results.filter(result => result.status === 'rejected').length;

          if (failed > 0) {
            console.log(`⚠️ Some notifications failed for user ${userUpdate.userId}:`, 
              results
                .filter(result => result.status === 'rejected')
                .map(result => result.reason)
            );
          }

          console.log(`📱 Notification results for user ${userUpdate.userId}:`, {
            successful,
            failed,
            total: results.length
          });
        }

      } catch (error) {
        console.error(`❌ Error processing notifications for user ${userUpdate.userId}:`, error);
      }
    });

    // Execute all notification triggers in parallel
    const finalResults = await Promise.allSettled(notificationPromises);
    
    // Detailed summary of notification attempts
    const summary = {
      total: affectedUsers.length,
      registered: affectedUsers.filter(u => u.userId).length,
      guests: affectedUsers.filter(u => !u.userId).length,
      successful: finalResults.filter(r => r.status === 'fulfilled').length,
      failed: finalResults.filter(r => r.status === 'rejected').length
    };
    
    console.log('📊 Notification processing summary:', summary);
    
  } catch (error) {
    console.error('❌ Fatal error in triggerWebPushNotifications:', error);
  }
}

// Function to clean up stale position tracking entries
async function cleanupStalePositions(supabase) {
  try {
    // Get all users in the position tracking table
    const { data: trackedUsers } = await supabase
      .from('user_queue_positions')
      .select('user_id');

    if (!trackedUsers || trackedUsers.length === 0) {
      return;
    }

    // Get all users actually in the queue
    const { data: queueUsers } = await supabase
      .from('computer_queue')
      .select('user_id');

    // Create sets for comparison
    const trackedUserIds = new Set(trackedUsers.map(u => u.user_id));
    const queueUserIds = new Set(queueUsers?.map(u => u.user_id) || []);

    // Find users who are tracked but no longer in queue
    const staleUserIds = [...trackedUserIds].filter(id => !queueUserIds.has(id));

    if (staleUserIds.length > 0) {
      // Delete stale entries
      const { error } = await supabase
        .from('user_queue_positions')
        .delete()
        .in('user_id', staleUserIds);

      if (error) {
        console.error('Error cleaning up stale positions:', error);
      } else {
        console.log(`✅ Cleaned up ${staleUserIds.length} stale position entries`);
      }
    }
  } catch (error) {
    console.error('Error in cleanupStalePositions:', error);
  }
} 