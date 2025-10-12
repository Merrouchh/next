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
      .select('id, username, is_admin, is_staff, phone')
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

    // Get event details to check registration limit and phone verification
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('registration_limit, registered_count, team_type, phone_verification_required')
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

    // Check if phone verification is required
    if (eventData.phone_verification_required && !userData.phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number required',
        message: 'This event requires a phone number. Please add a phone number to your profile before registering.'
      });
    }

    // Validate and check phone for team members if this is a team event
    if (eventData.team_type !== 'solo' && registrationData.teamMembers && registrationData.teamMembers.length > 0) {
      const teamMemberIds = registrationData.teamMembers.map(member => member.userId || member.user_id);
      
      // For duo events, exactly one team member is required
      if (eventData.team_type === 'duo' && teamMemberIds.length !== 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid team size',
          message: 'For duo events, you must select exactly one team member.'
        });
      }
      
      // Check if phone verification is required for team members
      if (eventData.phone_verification_required && teamMemberIds.length > 0) {
        const { data: teamMemberProfiles, error: teamPhoneError } = await supabase
          .from('users')
          .select('id, username, phone')
          .in('id', teamMemberIds);
        
        if (teamPhoneError) {
          console.error('[INTERNAL API] Error checking team member phone numbers:', teamPhoneError);
          return res.status(500).json({
            success: false,
            error: 'Failed to verify team members',
            message: 'Unable to verify team member phone numbers'
          });
        }
        
        // Check for any team members without phone numbers
        const invalidTeamMembers = teamMemberProfiles
          .filter(member => !member.phone || member.phone.trim() === '')
          .map(member => member.username);
        
        if (invalidTeamMembers.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Phone number required',
            message: `The following team members don't have phone numbers: ${invalidTeamMembers.join(', ')}. All participants must have a phone number for this event.`
          });
        }
      }
      
      // Check if any team members are already registered for this event
      const { data: existingTeamMembers } = await supabase
        .from('event_registrations')
        .select('user_id, username')
        .eq('event_id', eventId)
        .in('user_id', teamMemberIds);
      
      if (existingTeamMembers && existingTeamMembers.length > 0) {
        const alreadyRegistered = existingTeamMembers.map(member => member.username).join(', ');
        return res.status(400).json({
          success: false,
          error: 'Team member already registered',
          message: `The following team members are already registered for this event: ${alreadyRegistered}`
        });
      }
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

    // Insert team members if this is a team event
    if (eventData.team_type !== 'solo' && registrationData.teamMembers && registrationData.teamMembers.length > 0) {
      const teamMembersToInsert = registrationData.teamMembers.map(member => ({
        registration_id: newRegistration.id,
        user_id: member.userId || member.user_id,
        username: member.username
      }));
      
      const { error: teamMemberError } = await supabase
        .from('event_team_members')
        .insert(teamMembersToInsert);
      
      if (teamMemberError) {
        console.error('[INTERNAL API] Error adding team members:', teamMemberError);
        // If there's an error adding team members, delete the registration to maintain consistency
        await supabase
          .from('event_registrations')
          .delete()
          .eq('id', newRegistration.id);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to add team members',
          message: 'Unable to complete registration with team members'
        });
      }
      
      console.log('[INTERNAL API] Successfully added team members:', teamMembersToInsert.length);
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

    // Delete team members first if they exist
    const { error: teamDeleteError } = await supabase
      .from('event_team_members')
      .delete()
      .eq('registration_id', existingRegistration.id);
    
    if (teamDeleteError) {
      console.error('[INTERNAL API] Error deleting team members:', teamDeleteError);
      // Continue with registration deletion even if team member deletion fails
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