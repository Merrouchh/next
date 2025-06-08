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

  // Check if user is admin or staff (staff can only manage queue)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, is_staff')
    .eq('id', user.id)
    .single();

  if (userError || !userData || (!userData.is_admin && !userData.is_staff)) {
    throw new Error('Admin or staff access required');
  }

  return user;
}

export default async function handler(req, res) {
  try {
    const admin = await verifyAdmin(req.headers.authorization);
    
    switch (req.method) {
      case 'POST':
        return await handleAddToQueue(req, res, admin);
      case 'PUT':
        return await handleUpdateQueue(req, res, admin);
      case 'DELETE':
        return await handleRemoveFromQueue(req, res, admin);
      case 'PATCH':
        return await handleUpdateSettings(req, res, admin);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Queue management error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Add someone to the queue (physical waiter)
async function handleAddToQueue(req, res, admin) {
  const { userName, phoneNumber, notes, computerType = 'any', isPhysical = true, userId } = req.body;

  if (!userName) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // If userId is provided, use it; otherwise look up user
    let finalUserId = userId;
    let finalPhoneNumber = phoneNumber;
    
    if (!finalUserId) {
      // Check if user exists in the system
      const { data: userData } = await supabase
        .from('users')
        .select('id, username, phone')
        .eq('username', userName.toLowerCase())
        .single();

      if (userData) {
        finalUserId = userData.id;
        // Use user's phone if no phone number provided
        if (!finalPhoneNumber && userData.phone) {
          finalPhoneNumber = userData.phone;
        }
      }
    }

    // Check if user is already in queue (if we have a user ID)
    if (finalUserId) {
      const { data: existingEntry } = await supabase
        .from('computer_queue')
        .select('id')
        .eq('user_id', finalUserId)
        .eq('status', 'waiting')
        .single();

      if (existingEntry) {
        return res.status(400).json({ error: 'User is already in the queue' });
      }
    }

    // Get next position
    const { data: nextPos } = await supabase.rpc('get_next_queue_position');

    // Add to queue
    const { data: queueEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: userName,
        phone_number: finalPhoneNumber,
        notes: notes,
        computer_type: computerType,
        position: nextPos,
        is_physical: isPhysical,
        created_by: admin.id,
        user_id: finalUserId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding to queue:', insertError);
      return res.status(500).json({ error: 'Failed to add to queue' });
    }

    // Check and handle automatic mode after addition
    await handleAutomaticModeAfterChange();

    return res.status(201).json({
      success: true,
      message: `${userName} added to queue at position ${nextPos}`,
      data: queueEntry
    });

  } catch (error) {
    console.error('Error in handleAddToQueue:', error);
    return res.status(500).json({ error: 'Failed to add to queue' });
  }
}

// Update queue entry
async function handleUpdateQueue(req, res, admin) {
  const { id, notes, computerType, status } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Queue entry ID is required' });
  }

  try {
    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (computerType !== undefined) updates.computer_type = computerType;
    if (status !== undefined) updates.status = status;

    const { data: updatedEntry, error: updateError } = await supabase
      .from('computer_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating queue entry:', updateError);
      return res.status(500).json({ error: 'Failed to update queue entry' });
    }

    return res.status(200).json({
      success: true,
      message: 'Queue entry updated',
      data: updatedEntry
    });

  } catch (error) {
    console.error('Error in handleUpdateQueue:', error);
    return res.status(500).json({ error: 'Failed to update queue entry' });
  }
}

// Remove someone from queue
async function handleRemoveFromQueue(req, res, admin) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Queue entry ID is required' });
  }

  try {
    // Remove from queue
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return res.status(500).json({ error: 'Failed to remove from queue' });
    }

    // Add a small delay to ensure database operations are complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check and handle automatic mode after removal
    await handleAutomaticModeAfterChange();

    return res.status(200).json({
      success: true,
      message: 'Removed from queue'
    });

  } catch (error) {
    console.error('Error in handleRemoveFromQueue:', error);
    return res.status(500).json({ error: 'Failed to remove from queue' });
  }
}

// Update queue settings
async function handleUpdateSettings(req, res, admin) {
  const { isActive, allowOnlineJoining, maxQueueSize, automaticMode } = req.body;

  try {
    const updates = { updated_by: admin.id };
    if (isActive !== undefined) updates.is_active = isActive;
    if (allowOnlineJoining !== undefined) updates.allow_online_joining = allowOnlineJoining;
    if (maxQueueSize !== undefined) updates.max_queue_size = maxQueueSize;
    if (automaticMode !== undefined) updates.automatic_mode = automaticMode;

    const { data: settings, error: updateError } = await supabase
      .from('queue_settings')
      .update(updates)
      .eq('id', 1) // Assuming single settings row
      .select()
      .single();

    if (updateError) {
      console.error('Error updating queue settings:', updateError);
      return res.status(500).json({ error: 'Failed to update queue settings' });
    }

    return res.status(200).json({
      success: true,
      message: 'Queue settings updated',
      data: settings
    });

  } catch (error) {
    console.error('Error in handleUpdateSettings:', error);
    return res.status(500).json({ error: 'Failed to update queue settings' });
  }
} 