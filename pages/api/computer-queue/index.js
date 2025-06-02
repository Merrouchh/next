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

    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      return res.status(500).json({ error: 'Failed to remove from queue' });
    }

    return res.status(200).json({ 
      message: self_remove === 'true' ? 'You have been removed from the queue' : 'Removed from queue successfully' 
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

    // Update positions for all queue entries
    const updatePromises = queue.map((entry, index) => 
      supabase
        .from('computer_queue')
        .update({ 
          position: index + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
    );

    await Promise.all(updatePromises);

    return res.status(200).json({ message: 'Queue updated successfully' });
  } catch (error) {
    console.error('Error in updateQueue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 