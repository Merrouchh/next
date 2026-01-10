import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for admin event management
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
    const { action, eventData, eventId } = req.body;

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
    console.log('[INTERNAL API] Looking up user with ID:', req.body.userId);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, is_admin, is_staff')
      .eq('id', req.body.userId)
      .single();

    if (userError || !userData) {
      console.error('[INTERNAL API] Error getting user data:', userError);
      console.error('[INTERNAL API] User ID provided:', req.body.userId);
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: 'Unable to verify user identity',
        details: userError?.message || 'No user data returned'
      });
    }

    console.log('[INTERNAL API] User found:', { id: userData.id, username: userData.username, is_admin: userData.is_admin, is_staff: userData.is_staff });

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
      case 'get-events':
        return await handleGetEvents(req, res);
      case 'create':
        return await handleCreateEvent(req, res, eventData);
      case 'update':
        return await handleUpdateEvent(req, res, eventId, eventData);
      case 'delete':
        return await handleDeleteEvent(req, res, eventId);
      case 'upload-image':
        return await handleUploadImage(req, res, eventData);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: get-events, create, update, delete, upload-image'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process admin events request'
    });
  }
}

// Get events
async function handleGetEvents(req, res) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Fetching events directly from Supabase');

    // Get events directly from Supabase instead of calling external API
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('[INTERNAL API] Error fetching events from Supabase:', eventsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events from database',
        message: eventsError.message
      });
    }

    console.log('[INTERNAL API] Successfully fetched events:', events?.length || 0);

    return res.status(200).json({
      success: true,
      result: events || []
    });
  } catch (error) {
    console.error('[INTERNAL API] Get events error:', error);
    console.error('[INTERNAL API] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get events',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Create event
async function handleCreateEvent(req, res, eventData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Creating event:', eventData);

    // Create event directly in Supabase
    const { data: newEvent, error: createError } = await supabase
      .from('events')
      .insert({
        title: eventData.title,
        description: eventData.description || '',
        date: eventData.date,
        time: eventData.time || '',
        location: eventData.location || '',
        game: eventData.game || '',
        status: eventData.status || 'Upcoming',
        image: eventData.image || null,
        registration_limit: eventData.registration_limit || null,
        team_type: eventData.team_type || 'solo',
        phone_verification_required: eventData.phone_verification_required !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('[INTERNAL API] Error creating event in Supabase:', createError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create event in database',
        message: createError.message
      });
    }

    console.log('[INTERNAL API] Successfully created event:', newEvent.id);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      result: newEvent
    });
  } catch (error) {
    console.error('[INTERNAL API] Create event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create event',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Update event
async function handleUpdateEvent(req, res, eventId, eventData) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Updating event:', eventId, eventData);

    // Prepare update data - only include fields that are provided
    const updateFields = {
      title: eventData.title,
      description: eventData.description,
      date: eventData.date,
      time: eventData.time,
      location: eventData.location,
      game: eventData.game,
      status: eventData.status,
      updated_at: new Date().toISOString()
    };
    
    // Only include these fields if they are provided in eventData
    if (eventData.image !== undefined) {
      updateFields.image = eventData.image;
    }
    if (eventData.registration_limit !== undefined) {
      updateFields.registration_limit = eventData.registration_limit === '' || eventData.registration_limit === null 
        ? null 
        : parseInt(eventData.registration_limit);
    }
    if (eventData.team_type !== undefined) {
      updateFields.team_type = eventData.team_type;
    }
    if (eventData.phone_verification_required !== undefined) {
      updateFields.phone_verification_required = eventData.phone_verification_required;
    }

    console.log('[INTERNAL API] Update fields:', updateFields);

    // Update event directly in Supabase
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateFields)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('[INTERNAL API] Error updating event in Supabase:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update event in database',
        message: updateError.message
      });
    }

    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The event you are trying to update does not exist'
      });
    }

    console.log('[INTERNAL API] Successfully updated event:', updatedEvent.id);

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      result: updatedEvent
    });
  } catch (error) {
    console.error('[INTERNAL API] Update event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update event',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Delete event
async function handleDeleteEvent(req, res, eventId) {
  try {
    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[INTERNAL API] Deleting event:', eventId);

    // Delete event directly from Supabase
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (deleteError) {
      console.error('[INTERNAL API] Error deleting event from Supabase:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete event from database',
        message: deleteError.message
      });
    }

    console.log('[INTERNAL API] Successfully deleted event:', eventId);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('[INTERNAL API] Delete event error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete event',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Upload image
async function handleUploadImage(req, res, imageData) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/events/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: imageData
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[INTERNAL API] Non-JSON response from upload image API:', text);
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upload image API',
        message: 'Expected JSON response but got: ' + contentType
      });
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Upload image error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload image',
      message: 'Internal server error'
    });
  }
}

export default handler;