import createClient from '../../../utils/supabase/api';

/**
 * Internal API for queue management operations
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

    // Get user data to verify they exist
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

    // Route to appropriate handler based on action
    switch (action) {
      case 'join':
        return await handleJoinQueue(req, res, queueData);
      case 'leave':
        return await handleLeaveQueue(req, res, queueData);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: join, leave'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process queue management request'
    });
  }
}

// Join queue
async function handleJoinQueue(req, res, queueData) {
  try {
    const supabase = createClient(req, res);
    
    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get queue settings (but don't enforce activation requirements)
    const { data: settings } = await supabase
      .from('queue_settings')
      .select('max_queue_size')
      .eq('id', 1)
      .single();

    // If no settings found, use defaults
    const maxQueueSize = settings?.max_queue_size || 50;

    // Check if user is already in queue
    const { data: existingEntry, error: checkError } = await supabase
      .from('computer_queue')
      .select('id, position, status')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return res.status(500).json({
        success: false,
        error: 'Failed to check existing queue entry'
      });
    }

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        error: 'You are already in the queue',
        position: existingEntry.position
      });
    }

    // Get current queue size
    const { count: currentSize, error: countError } = await supabase
      .from('computer_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'waiting');

    if (countError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to check queue size'
      });
    }

    if (currentSize >= maxQueueSize) {
      return res.status(400).json({
        success: false,
        error: 'Queue is full'
      });
    }

    // Get user profile for username
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get user profile'
      });
    }

    // Add user to queue
    const { data: newEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: profile.username,
        user_id: user.id,
        computer_type: queueData.computer_type || 'any',
        position: currentSize + 1,
        is_physical: false,
        status: 'waiting',
        notes: queueData.notes || null
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to join queue'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully joined queue',
      position: newEntry.position,
      queue_entry: newEntry
    });

  } catch (error) {
    console.error('[INTERNAL API] Join queue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to join queue',
      message: 'Internal server error'
    });
  }
}

// Leave queue
async function handleLeaveQueue(req, res) {
  try {
    const supabase = createClient(req, res);
    
    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is in queue
    const { data: existingEntry, error: checkError } = await supabase
      .from('computer_queue')
      .select('id, position, status')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return res.status(500).json({
        success: false,
        error: 'Failed to check queue entry'
      });
    }

    if (!existingEntry) {
      return res.status(400).json({
        success: false,
        error: 'You are not in the queue'
      });
    }

    // Remove user from queue
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', existingEntry.id);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to leave queue'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully left queue'
    });

  } catch (error) {
    console.error('[INTERNAL API] Leave queue error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to leave queue',
      message: 'Internal server error'
    });
  }
}

export default handler;