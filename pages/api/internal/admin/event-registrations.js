import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for admin event registrations management
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
      message: 'Failed to process admin event registrations request'
    });
  }
}

// Get event details
async function handleGetEvent(req, res, eventId) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Fetching event details for ID:', eventId);

    // Get event directly from Supabase
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('[INTERNAL API] Error fetching event from Supabase:', eventError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch event from database',
        message: eventError.message
      });
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The requested event does not exist'
      });
    }

    console.log('[INTERNAL API] Successfully fetched event:', event.id);

    return res.status(200).json({
      success: true,
      result: { event }
    });
  } catch (error) {
    console.error('[INTERNAL API] Get event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get event',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Get registrations
async function handleGetRegistrations(req, res, eventId) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Fetching registrations for event ID:', eventId);

    // Get registrations directly from Supabase
    const { data: registrations, error: registrationsError } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .order('id', { ascending: false });

    if (registrationsError) {
      console.error('[INTERNAL API] Error fetching registrations from Supabase:', registrationsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch registrations from database',
        message: registrationsError.message
      });
    }

    console.log('[INTERNAL API] Raw registrations data:', registrations.length > 0 ? Object.keys(registrations[0]) : 'No registrations found');

    // Get user details for each registration
    const userIds = [...new Set(registrations.map(reg => reg.user_id).filter(Boolean))];
    let users = {};
    
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, email, phone')
        .in('id', userIds);
      
      if (usersError) {
        console.error('[INTERNAL API] Error fetching users:', usersError);
      } else {
        users = usersData.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});
      }
    }

    // Format the registrations data
    const formattedRegistrations = registrations.map(reg => {
      const user = users[reg.user_id] || {
        id: reg.user_id,
        username: 'Unknown User',
        email: 'No email available',
        phone: 'No phone available'
      };

      // Use the most appropriate date field available
      const registrationDate = reg.created_at || reg.registration_date || reg.date || new Date().toISOString();
      
      return {
        id: reg.id,
        event_id: reg.event_id,
        user_id: reg.user_id,
        status: reg.status,
        notes: reg.notes,
        registration_date: registrationDate,
        registration_date_formatted: new Date(registrationDate).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        user: user
      };
    });

    console.log('[INTERNAL API] Successfully fetched registrations:', formattedRegistrations.length);

    return res.status(200).json({
      success: true,
      result: formattedRegistrations
    });
  } catch (error) {
    console.error('[INTERNAL API] Get registrations error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get registrations',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Delete registration
async function handleDeleteRegistration(req, res, eventId, registrationData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Deleting registration:', registrationData);

    // Delete registration directly from Supabase
    const { error: deleteError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', registrationData.id)
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('[INTERNAL API] Error deleting registration from Supabase:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete registration from database',
        message: deleteError.message
      });
    }

    console.log('[INTERNAL API] Successfully deleted registration:', registrationData.id);

    return res.status(200).json({
      success: true,
      message: 'Registration deleted successfully'
    });
  } catch (error) {
    console.error('[INTERNAL API] Delete registration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete registration',
      message: 'Internal server error',
      details: error.message
    });
  }
}

export default handler;