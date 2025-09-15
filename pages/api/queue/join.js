import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get next position with retry logic (backup for race conditions)
async function getNextQueuePositionWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to get next position
      const { data: nextPos, error } = await supabase.rpc('get_next_queue_position');
      
      if (error) {
        console.error(`Attempt ${attempt}: Error getting next position:`, error);
        if (attempt === maxRetries) throw error;
        continue;
      }
      
      // Double-check that this position doesn't already exist (race condition check)
      const { data: existingPosition, error: checkError } = await supabase
        .from('computer_queue')
        .select('id')
        .eq('position', nextPos)
        .eq('status', 'waiting')
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found (good)
        console.error(`Attempt ${attempt}: Error checking position:`, checkError);
        if (attempt === maxRetries) throw checkError;
        continue;
      }
      
      if (!existingPosition) {
        // Position is available, return it
        return nextPos;
      } else {
        // Position already exists (race condition detected), try again
        console.warn(`Race condition detected: Position ${nextPos} already exists. Attempt ${attempt}/${maxRetries}`);
        if (attempt === maxRetries) {
          // Last attempt: force a higher position
          const { data: maxPos } = await supabase.rpc('get_next_queue_position');
          return (maxPos || 0) + attempt;
        }
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    } catch (error) {
      console.error(`Attempt ${attempt}: Unexpected error:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}

// Function to handle automatic mode after queue changes
async function handleAutomaticModeAfterChange() {
  try {
    // Get current queue status and settings
    const { data: queueStatus, error: statusError } = await supabase.rpc('get_queue_status');
    
    if (statusError) {
      console.error('Error getting queue status in automatic mode:', statusError);
      return;
    }
    
    const status = Array.isArray(queueStatus) ? queueStatus[0] : queueStatus;
    
    if (!status) {
      console.log('No queue status found');
      return;
    }
    
    if (!status.automatic_mode) {
      console.log('Automatic mode is off, skipping queue control');
      return;
    }

    const currentQueueSize = status.current_queue_size || 0;
    const isCurrentlyActive = status.is_active;

    console.log(`Automatic mode check: Queue size=${currentQueueSize}, Currently active=${isCurrentlyActive}, Automatic mode=${status.automatic_mode}`);

    // Auto-control logic
    if (currentQueueSize > 0 && !isCurrentlyActive) {
      // Should be active but isn't - turn it on
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: true })
        .eq('id', 1);
      
      if (updateError) {
        console.error('Error activating queue:', updateError);
      } else {
        console.log('Automatic mode: Started queue system (queue not empty)');
      }
    } else if (currentQueueSize === 0 && isCurrentlyActive) {
      // Should be inactive but isn't - turn it off
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: false })
        .eq('id', 1);
      
      if (updateError) {
        console.error('Error deactivating queue:', updateError);
      } else {
        console.log('Automatic mode: Stopped queue system (queue empty)');
      }
    } else {
      console.log('Queue state is correct, no changes needed');
    }
  } catch (error) {
    console.error('Error in automatic mode handler:', error);
  }
}

export default async function handler(req, res) {
  try {
    // Verify authentication for all methods
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'POST':
        return await handleJoinQueue(req, res, user);
      case 'DELETE':
        return await handleLeaveQueue(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Queue API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Handle joining the queue
async function handleJoinQueue(req, res, user) {
  try {
    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, phone')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(400).json({ error: 'User not found' });
    }

    const { computerType = 'any' } = req.body;

    // Check if queue is active and allows online joining
    const { data: queueStatus } = await supabase.rpc('get_queue_status');
    
    // Handle case where queueStatus is an array
    const status = Array.isArray(queueStatus) ? queueStatus[0] : queueStatus;
    
    if (!status || (!status.is_active && !status.automatic_mode)) {
      return res.status(400).json({ error: 'Queue is not currently active' });
    }

    if (!status.allow_online_joining) {
      return res.status(400).json({ error: 'Online joining is not currently allowed' });
    }

    if (status.current_queue_size >= status.max_queue_size) {
      return res.status(400).json({ error: 'Queue is full' });
    }

    // Check if user is already in queue
    const { data: existingEntry } = await supabase
      .from('computer_queue')
      .select('id, position')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .single();

    if (existingEntry) {
      return res.status(400).json({ 
        error: 'You are already in the queue',
        position: existingEntry.position
      });
    }

    // Get next position using retry logic to handle race conditions
    const nextPos = await getNextQueuePositionWithRetry();

    // Add to queue
    const { data: queueEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: userData.username,
        phone_number: userData.phone || null,
        computer_type: computerType,
        position: nextPos,
        is_physical: false,
        user_id: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error joining queue:', insertError);
      
      // If it's a unique constraint violation (race condition), try once more with a higher position
      if (insertError.code === '23505') { // Unique violation
        console.log('Detected race condition, retrying with higher position...');
        const { data: maxPos } = await supabase.rpc('get_next_queue_position');
        const retryPos = (maxPos || 0) + Math.floor(Math.random() * 10) + 1;
        
        const { data: retryQueueEntry, error: retryError } = await supabase
          .from('computer_queue')
          .insert({
            user_name: userData.username,
            phone_number: userData.phone || null,
            computer_type: computerType,
            position: retryPos,
            is_physical: false,
            user_id: user.id
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('Retry also failed:', retryError);
          return res.status(500).json({ error: 'Failed to join queue due to high traffic. Please try again.' });
        }
        
        // Check and handle automatic mode after joining
        await handleAutomaticModeAfterChange();
        
        return res.status(201).json({
          success: true,
          message: `You joined the queue at position ${retryPos}`,
          data: {
            id: retryQueueEntry.id,
            position: retryPos,
            computerType: computerType,
            estimatedWait: retryPos * 5
          }
        });
      }
      
      return res.status(500).json({ error: 'Failed to join queue' });
    }

    // Check and handle automatic mode after joining
    await handleAutomaticModeAfterChange();

    return res.status(201).json({
      success: true,
      message: `You joined the queue at position ${nextPos}`,
      data: {
        id: queueEntry.id,
        position: nextPos,
        computerType: computerType,
        estimatedWait: nextPos * 5 // Rough estimate: 5 minutes per person
      }
    });
  } catch (error) {
    console.error('Error in handleJoinQueue:', error);
    return res.status(500).json({ error: 'Failed to join queue. Please try again.' });
  }
}

// Handle leaving the queue
async function handleLeaveQueue(req, res, user) {
  try {
    // Find user's queue entry
    const { data: queueEntry, error: findError } = await supabase
      .from('computer_queue')
      .select('id, position, user_name')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .single();

    if (findError || !queueEntry) {
      return res.status(404).json({ error: 'You are not currently in the queue' });
    }

    // Remove user from queue
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', queueEntry.id);

    if (deleteError) {
      console.error('Error leaving queue:', deleteError);
      return res.status(500).json({ error: 'Failed to leave queue' });
    }

    // Add a small delay to ensure database operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check and handle automatic mode after removal
    await handleAutomaticModeAfterChange();

    return res.status(200).json({
      success: true,
      message: `${queueEntry.user_name} has left the queue`
    });

  } catch (error) {
    console.error('Error in handleLeaveQueue:', error);
    return res.status(500).json({ error: 'Failed to leave queue' });
  }
} 