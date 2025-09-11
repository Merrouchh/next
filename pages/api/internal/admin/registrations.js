import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for admin registrations management
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
    const { action, eventId, registrationData } = req.body;

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
      case 'get-event':
        return await handleGetEvent(req, res, eventId);
      case 'get-registrations':
        return await handleGetRegistrations(req, res, eventId);
      case 'delete-registration':
        return await handleDeleteRegistration(req, res, eventId, registrationData);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: get-event, get-registrations, delete-registration'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process admin registrations request'
    });
  }
}

// Get event details
async function handleGetEvent(req, res, eventId) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/events/${eventId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Get event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get event',
      message: 'Internal server error'
    });
  }
}

// Get registrations
async function handleGetRegistrations(req, res, eventId) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/events/${eventId}/registrations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Get registrations error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get registrations',
      message: 'Internal server error'
    });
  }
}

// Delete registration
async function handleDeleteRegistration(req, res, eventId, registrationData) {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/events/${eventId}/registrations`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify(registrationData)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Delete registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete registration',
      message: 'Internal server error'
    });
  }
}

export default handler;