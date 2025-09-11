import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for admin queue management
 * This API handles authentication server-side and calls the original APIs internally
 * This prevents authorization headers from being exposed to the client
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Get the action and parameters from the request body
    const { action, queueData } = req.body;

    // Basic validation
    if (!action) {
      return res.status(400).json({ 
        error: 'Invalid request parameters',
        details: 'action is required'
      });
    }

    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get user data to verify they exist and get their admin status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, is_admin, is_staff')
      .eq('id', req.body.userId)
      .single();

    if (userError || !userData) {
      console.error('Error getting user data:', userError);
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: 'Unable to verify user identity'
      });
    }

    // Check if user has admin privileges
    if (!userData.is_admin && !userData.is_staff) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied',
        message: 'Admin privileges required'
      });
    }

    // Route to appropriate handler based on action
    switch (action) {
      case 'toggle-active':
        return await handleToggleActive(req, res, queueData);
      case 'toggle-automatic':
        return await handleToggleAutomatic(req, res, queueData);
      case 'toggle-online-joining':
        return await handleToggleOnlineJoining(req, res, queueData);
      case 'add-person':
        return await handleAddPerson(req, res, queueData);
      case 'delete-entry':
        return await handleDeleteEntry(req, res, queueData);
      case 'reorder':
        return await handleReorder(req, res, queueData);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: toggle-active, toggle-automatic, toggle-online-joining, add-person, delete-entry, reorder'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process admin queue management request'
    });
  }
}

// Toggle queue active status
async function handleToggleActive(req, res, queueData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/queue/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ isActive: queueData.isActive })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Toggle active error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle active status',
      message: 'Internal server error'
    });
  }
}

// Toggle automatic mode
async function handleToggleAutomatic(req, res, queueData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/queue/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ automaticMode: queueData.automaticMode })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Toggle automatic error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle automatic mode',
      message: 'Internal server error'
    });
  }
}

// Toggle online joining
async function handleToggleOnlineJoining(req, res, queueData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/queue/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ allowOnlineJoining: queueData.allowOnlineJoining })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Toggle online joining error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle online joining',
      message: 'Internal server error'
    });
  }
}

// Add person to queue
async function handleAddPerson(req, res, queueData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { userName, phoneNumber, notes, computerType = 'any', isPhysical = true, userId } = queueData;

    if (!userName || !userName.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Username is required' 
      });
    }

    // Check if user is already in queue (if we have a user ID)
    if (userId) {
      const { data: existingEntry } = await supabase
        .from('computer_queue')
        .select('id, position, user_name')
        .eq('user_id', userId)
        .eq('status', 'waiting')
        .single();

      if (existingEntry) {
        return res.status(400).json({ 
          success: false,
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
        success: false,
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
      return res.status(500).json({ 
        success: false,
        error: 'Failed to get next queue position' 
      });
    }

    // Add to queue with validation
    const { data: queueEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: userName.trim(),
        phone_number: phoneNumber?.trim() || null,
        notes: notes?.trim() || null,
        computer_type: computerType,
        position: nextPos,
        is_physical: isPhysical,
        created_by: req.body.userId,
        user_id: userId
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding to queue:', insertError);
      if (insertError.code === '23505') { // Unique constraint violation
        return res.status(400).json({ 
          success: false,
          error: 'User is already in the queue' 
        });
      }
      return res.status(500).json({ 
        success: false,
        error: 'Failed to add to queue' 
      });
    }

    // Verify the addition was successful
    if (!queueEntry) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to add to queue - no entry returned' 
      });
    }

    // Add small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`Queue addition successful: ${userName} added at position ${nextPos}`);

    return res.status(201).json({
      success: true,
      message: `${userName} added to queue at position ${nextPos}`,
      data: queueEntry
    });

  } catch (error) {
    console.error('[INTERNAL API] Add person error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add person to queue',
      message: 'Internal server error'
    });
  }
}

// Delete entry from queue
async function handleDeleteEntry(req, res, queueData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { id } = queueData;

    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Queue entry ID is required' 
      });
    }

    // Get the entry being removed with more details
    const { data: removedEntry, error: fetchError } = await supabase
      .from('computer_queue')
      .select('id, position, user_name, status')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching entry to remove:', fetchError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to find queue entry' 
      });
    }

    if (!removedEntry) {
      return res.status(404).json({ 
        success: false,
        error: 'Queue entry not found' 
      });
    }

    if (removedEntry.status !== 'waiting') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot remove entry that is not waiting' 
      });
    }

    const removedPosition = removedEntry.position;

    // Remove from queue with better error handling
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', id)
      .eq('status', 'waiting'); // Extra safety check

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to remove from queue' 
      });
    }

    // Verify the removal was successful
    const { data: verifyRemoval } = await supabase
      .from('computer_queue')
      .select('id')
      .eq('id', id)
      .single();

    if (verifyRemoval) {
      console.error('Queue entry still exists after deletion attempt');
      return res.status(500).json({ 
        success: false,
        error: 'Failed to remove from queue - entry still exists' 
      });
    }

    // Add delay to allow database triggers to complete position reordering
    await new Promise(resolve => setTimeout(resolve, 200));

    console.log(`Queue removal successful: ${removedEntry.user_name} removed from position ${removedPosition}`);

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
    console.error('[INTERNAL API] Delete entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete entry from queue',
      message: 'Internal server error'
    });
  }
}

// Reorder queue
async function handleReorder(req, res, queueData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/queue/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(queueData)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Reorder error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reorder queue',
      message: 'Internal server error'
    });
  }
}

export default handler;