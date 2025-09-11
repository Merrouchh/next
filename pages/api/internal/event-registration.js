import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for event registration operations
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

    // Get user data to verify they exist
    const userId = req.body.userId || registrationData?.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID required',
        message: 'userId is required for registration'
      });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, is_admin, is_staff')
      .eq('id', userId)
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
      case 'register':
        return await handleRegister(req, res, eventId, registrationData, userId, userData);
      case 'unregister':
        return await handleUnregister(req, res, eventId, userId);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: register, unregister'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process event registration request'
    });
  }
}

// Register for event
async function handleRegister(req, res, eventId, registrationData, userId, userData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Registering user for event:', eventId, registrationData, 'userId:', userId);

    // Check if user is already registered
    const { data: existingRegistration } = await supabase
      .from('event_registrations')
      .select('id, team_name, team_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        error: 'Already registered',
        message: 'User is already registered for this event'
      });
    }

    // Get event details to check registration limit
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.error('[INTERNAL API] Error getting event data:', eventError);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'Unable to find the specified event'
      });
    }

    // Check if registration limit is reached
    if (eventData.registration_limit && eventData.registered_count >= eventData.registration_limit) {
      return res.status(400).json({
        success: false,
        error: 'Registration full',
        message: 'This event has reached its registration limit'
      });
    }

    // Prepare registration data
    const registrationRecord = {
      event_id: eventId,
      user_id: userId,
      username: userData.username,
      notes: registrationData.notes || null,
      team_name: registrationData.teamName || null
    };

    // Insert registration
    const { data: newRegistration, error: insertError } = await supabase
      .from('event_registrations')
      .insert(registrationRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[INTERNAL API] Error inserting registration:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to register for event',
        message: 'Database error occurred'
      });
    }

    // Update event registered count
    const { error: updateError } = await supabase
      .from('events')
      .update({ 
        registered_count: eventData.registered_count + 1
      })
      .eq('id', eventId);

    if (updateError) {
      console.error('[INTERNAL API] Error updating event count:', updateError);
      // Don't fail the registration if count update fails
    }

    console.log('[INTERNAL API] Registration successful:', newRegistration.id);

    return res.status(200).json({
      success: true,
      message: 'Successfully registered for event',
      registration: newRegistration
    });

  } catch (error) {
    console.error('[INTERNAL API] Register error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to register for event',
      message: 'Internal server error'
    });
  }
}

// Unregister from event
async function handleUnregister(req, res, eventId, userId) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Unregistering user from event:', eventId, 'userId:', userId);

    // Check if user is registered
    const { data: existingRegistration } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();

    if (!existingRegistration) {
      return res.status(400).json({
        success: false,
        error: 'Not registered',
        message: 'User is not registered for this event'
      });
    }

    // Delete registration
    const { error: deleteError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[INTERNAL API] Error deleting registration:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to unregister from event',
        message: 'Database error occurred'
      });
    }

    // Update event registered count
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('registered_count')
      .eq('id', eventId)
      .single();

      if (!eventError && eventData) {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            registered_count: Math.max(0, eventData.registered_count - 1)
          })
          .eq('id', eventId);

      if (updateError) {
        console.error('[INTERNAL API] Error updating event count:', updateError);
        // Don't fail the unregistration if count update fails
      }
    }

    console.log('[INTERNAL API] Unregistration successful');

    return res.status(200).json({
      success: true,
      message: 'Successfully unregistered from event'
    });

  } catch (error) {
    console.error('[INTERNAL API] Unregister error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to unregister from event',
      message: 'Internal server error'
    });
  }
}

export default handler;