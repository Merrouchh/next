import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  // Get user details
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, username')
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

  // Get next position
  const { data: nextPos } = await supabase.rpc('get_next_queue_position');

  // Add to queue
  const { data: queueEntry, error: insertError } = await supabase
    .from('computer_queue')
    .insert({
      user_name: userData.username,
      computer_type: computerType,
      position: nextPos,
      is_physical: false,
      user_id: user.id
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error joining queue:', insertError);
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