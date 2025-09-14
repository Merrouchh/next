import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for event operations
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
    const { action, eventId } = req.body;

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
      case 'get-registration-status':
        return await handleGetRegistrationStatus(req, res, eventId, supabase);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: get-registration-status'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process event operations request'
    });
  }
}

// Get registration status
async function handleGetRegistrationStatus(req, res, eventId, supabase) {
  try {
    console.log('[INTERNAL API] Getting registration status for eventId:', eventId);
    
    // Check if event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('[INTERNAL API] Error fetching event:', eventError);
      return res.status(404).json({ 
        success: false,
        error: 'Event not found',
        details: eventError.message 
      });
    }

    // Get user registration status
    const { data: registrationData, error: registrationError } = await supabase
      .from('event_registrations')
      .select('id, registration_date, status, notes, team_name, user_id')
      .eq('event_id', eventId)
      .eq('user_id', req.body.userId)
      .single();

    let isRegistered = false;
    let registrationInfo = null;
    let partnerInfo = null;

    if (registrationError) {
      if (registrationError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is not an error
        console.error('[INTERNAL API] Error fetching registration:', registrationError);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to fetch registration status',
          details: registrationError.message 
        });
      }
    } else {
      isRegistered = true;
      registrationInfo = registrationData;
      
      // For duo events, find partner in event_team_members table
      if (eventData.team_type === 'duo' && registrationData.id) {
        console.log('[INTERNAL API] Looking for duo partner in event_team_members for registration_id:', registrationData.id);
        
        // Get team members for this registration
        const { data: teamMembers, error: teamMembersError } = await supabase
          .from('event_team_members')
          .select('user_id, username')
          .eq('registration_id', registrationData.id);
          
        console.log('[INTERNAL API] Team members query result:', { teamMembers, teamMembersError });
        
        if (!teamMembersError && teamMembers && teamMembers.length > 0) {
          console.log('[INTERNAL API] Found team members:', teamMembers);
          console.log('[INTERNAL API] Current user ID:', req.body.userId);
          
          // For duo events, there should be exactly 2 members (the user + partner)
          // Find the partner (not the current user)
          const partner = teamMembers.find(member => member.user_id !== req.body.userId);
          
          if (partner) {
            partnerInfo = {
              username: partner.username,
              userId: partner.user_id
            };
            console.log('[INTERNAL API] Partner found in team members:', partnerInfo);
          } else {
            console.log('[INTERNAL API] No partner found in team members (only current user)');
            console.log('[INTERNAL API] All team members:', teamMembers.map(m => ({ user_id: m.user_id, username: m.username })));
          }
        } else {
          console.log('[INTERNAL API] Error fetching team members or no members found:', teamMembersError);
          console.log('[INTERNAL API] This means the partner is not registered yet in event_team_members table');
        }
      } else {
        console.log('[INTERNAL API] Not a duo event or no registration ID:', { 
          teamType: eventData.team_type, 
          registrationId: registrationData.id 
        });
      }
    }

    // If user is not registered, check if they are a team member in someone else's registration
    if (!isRegistered && (eventData.team_type === 'duo' || eventData.team_type === 'team')) {
      console.log('[INTERNAL API] User not registered, checking if they are a team member in someone else\'s registration');
      
      // Check if this user is a team member in someone else's registration
      const { data: partnerTeamMembers, error: partnerTeamError } = await supabase
        .from('event_team_members')
        .select(`
          registration_id,
          user_id,
          username,
          event_registrations!inner(
            id,
            user_id,
            username,
            team_name
          )
        `)
        .eq('user_id', req.body.userId)
        .eq('event_registrations.event_id', eventId);
        
      console.log('[INTERNAL API] Partner team members found:', partnerTeamMembers);
      
      if (!partnerTeamError && partnerTeamMembers && partnerTeamMembers.length > 0) {
        // This user is a team member in someone else's registration
        const teamMember = partnerTeamMembers[0];
        const mainRegistrant = teamMember.event_registrations;
        
        // Mark user as registered since they are part of a team
        isRegistered = true;
        registrationInfo = {
          id: teamMember.registration_id,
          team_name: mainRegistrant.team_name,
          user_id: req.body.userId,
          username: teamMember.username
        };
        
        partnerInfo = {
          username: mainRegistrant.username,
          userId: mainRegistrant.user_id
        };
        console.log('[INTERNAL API] User is a team member of:', partnerInfo, 'Registration info:', registrationInfo);
      } else {
        console.log('[INTERNAL API] User is not a team member in any registration');
      }
    }

    console.log('[INTERNAL API] Registration status:', { isRegistered, registrationInfo, partnerInfo });
    return res.status(200).json({ 
      success: true,
      isRegistered,
      registrationInfo,
      partnerInfo,
      eventData,
      // Add fields that frontend expects
      teamMembers: [], // Will be populated by frontend if needed
      availableTeamMembers: [], // Will be populated by frontend if needed
      registeredBy: isRegistered && partnerInfo ? partnerInfo.username : null
    });
    
  } catch (error) {
    console.error('[INTERNAL API] Get registration status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get registration status',
      message: 'Internal server error',
      details: error.message
    });
  }
}

export default handler;