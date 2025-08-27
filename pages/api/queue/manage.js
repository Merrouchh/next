import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
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

// Add someone to the queue (physical waiter) - IMPROVED
async function handleAddToQueue(req, res, admin) {
  const { userName, phoneNumber, notes, computerType = 'any', isPhysical = true, userId } = req.body;

  if (!userName || !userName.trim()) {
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
        .eq('username', userName.trim().toLowerCase())
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
        .select('id, position, user_name')
        .eq('user_id', finalUserId)
        .eq('status', 'waiting')
        .single();

      if (existingEntry) {
        return res.status(400).json({ 
          error: `User ${existingEntry.user_name} is already in the queue at position ${existingEntry.position}` 
        });
      }
    }

    // Also check by username to prevent duplicates
    const { data: duplicateCheck } = await supabase
      .from('computer_queue')
      .select('id, position, user_name')
      .eq('user_name', userName.trim())
      .eq('status', 'waiting')
      .single();

    if (duplicateCheck) {
      return res.status(400).json({ 
        error: `Username ${duplicateCheck.user_name} is already in the queue at position ${duplicateCheck.position}` 
      });
    }

    // Get next position with retry logic
    let nextPos;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const { data: nextPosData, error: posError } = await supabase.rpc('get_next_queue_position');
        
        if (posError) {
          console.error('Error getting next position:', posError);
          throw posError;
        }
        
        nextPos = nextPosData;
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (!nextPos) {
      return res.status(500).json({ error: 'Failed to get next queue position' });
    }

    // Add to queue with validation
    const { data: queueEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: userName.trim(),
        phone_number: finalPhoneNumber?.trim() || null,
        notes: notes?.trim() || null,
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
      if (insertError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'User is already in the queue' });
      }
      return res.status(500).json({ error: 'Failed to add to queue' });
    }

    // Verify the addition was successful
    if (!queueEntry) {
      return res.status(500).json({ error: 'Failed to add to queue - no entry returned' });
    }

    // Add small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`Queue addition successful: ${userName} added at position ${nextPos}`);

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
  const { id, notes, computerType, status, position } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Queue entry ID is required' });
  }

  try {
    // Get the current entry data before updating
    const { data: currentEntry, error: fetchError } = await supabase
      .from('computer_queue')
      .select('position, user_name, phone_number, computer_type')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching current entry:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch current entry' });
    }

    const oldPosition = currentEntry.position;

    const updates = {};
    if (notes !== undefined) updates.notes = notes;
    if (computerType !== undefined) updates.computer_type = computerType;
    if (status !== undefined) updates.status = status;
    if (position !== undefined) updates.position = position;

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

    // Position update completed

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
    // Get the entry being removed with more details
    const { data: removedEntry, error: fetchError } = await supabase
      .from('computer_queue')
      .select('id, position, user_name, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching entry to remove:', fetchError);
      return res.status(500).json({ error: 'Failed to find queue entry' });
    }

    if (!removedEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    if (removedEntry.status !== 'waiting') {
      return res.status(400).json({ error: 'Cannot remove entry that is not waiting' });
    }

    const wasPosition1 = removedEntry.position === 1;
    const removedPosition = removedEntry.position;

    // Remove from queue with better error handling
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', id)
      .eq('status', 'waiting'); // Extra safety check

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return res.status(500).json({ error: 'Failed to remove from queue' });
    }

    // Verify the removal was successful
    const { data: verifyRemoval } = await supabase
      .from('computer_queue')
      .select('id')
      .eq('id', id)
      .single();

    if (verifyRemoval) {
      console.error('Queue entry still exists after deletion attempt');
      return res.status(500).json({ error: 'Failed to remove from queue - entry still exists' });
    }

    // Add delay to allow database triggers to complete position reordering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify position reordering worked correctly
    const { data: remainingQueue } = await supabase
      .from('computer_queue')
      .select('id, position')
      .eq('status', 'waiting')
      .order('position');

    if (remainingQueue && remainingQueue.length > 0) {
      // Check if positions are sequential starting from 1
      const expectedPositions = remainingQueue.map((_, index) => index + 1);
      const actualPositions = remainingQueue.map(entry => entry.position);
      
      if (JSON.stringify(expectedPositions) !== JSON.stringify(actualPositions)) {
        console.warn('Position reordering may not be complete:', {
          expected: expectedPositions,
          actual: actualPositions
        });
      }
    }

    console.log(`Queue removal successful: ${removedEntry.user_name} removed from position ${removedPosition}`);

    // Check and handle automatic mode after removal
    await handleAutomaticModeAfterChange();

    return res.status(200).json({
      success: true,
      message: 'Removed from queue successfully',
      data: {
        removed: {
          id: id,
          name: removedEntry.user_name,
          position: removedPosition
        }
      }
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