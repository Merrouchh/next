import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for admin match details management
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
    const { action, eventId, matchDetailsData } = req.body;

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
      case 'swap-participants':
        return await handleSwapParticipants(req, res, eventId, matchDetailsData);
      case 'get-participants':
        return await handleGetParticipants(req, res, eventId);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: swap-participants, get-participants'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process admin match details request'
    });
  }
}

// Swap participants
async function handleSwapParticipants(req, res, eventId, matchDetailsData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/events/${eventId}/match-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(matchDetailsData)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Swap participants error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to swap participants',
      message: 'Internal server error'
    });
  }
}

// Get participants
async function handleGetParticipants(req, res, eventId) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/events/${eventId}/participants`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Get participants error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get participants',
      message: 'Internal server error'
    });
  }
}

export default handler;