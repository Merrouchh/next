import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log("Event registration API endpoint called:", req.method);
  
  try {
    // Initialize Supabase with anon key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // For GET requests, handle both authenticated and unauthenticated users
    if (req.method === 'GET') {
      const { eventId } = req.query;
      
      if (!eventId) {
        return res.status(400).json({ message: 'Event ID is required' });
      }
      
      // Try to get authenticated user if authorization header is provided
      let user = null;
      if (req.headers.authorization) {
        const authenticatedSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            global: {
              headers: {
                Authorization: req.headers.authorization
              }
            }
          }
        );
        
        const { data, error } = await authenticatedSupabase.auth.getUser();
        if (!error && data.user) {
          user = data.user;
          console.log("Authenticated user found:", user.id);
          return getRegistrationStatus(req, res, authenticatedSupabase, user);
        }
      }
      
      // For unauthenticated users, return limited info
      return getPublicRegistrationStatus(req, res, supabase, eventId);
    }
    
    // For POST and DELETE requests, authentication is required
    const authenticatedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      }
    );
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await authenticatedSupabase.auth.getUser();
    
    console.log("User authenticated:", !!user);
    
    if (authError || !user) {
      console.log("Authentication failed:", authError?.message);
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      });
    }
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'POST':
        return registerForEvent(req, res, authenticatedSupabase, user);
      case 'DELETE':
        return cancelRegistration(req, res, authenticatedSupabase, user);
      default:
        res.setHeader('Allow', ['POST', 'DELETE', 'GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Get public registration status for an event (limited info)
async function getPublicRegistrationStatus(req, res, supabase, eventId) {
  try {
    // Check if event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      throw eventError;
    }
    
    if (!eventData) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Return limited public information
    return res.status(200).json({
      isRegistered: false, // Default for unauthenticated users
      event: eventData,
      teamMembers: [],
      availableTeamMembers: [],
      registeredBy: null
    });
  } catch (error) {
    console.error('Error getting public registration status:', error);
    return res.status(500).json({ 
      message: 'Error getting registration status', 
      error: error.message 
    });
  }
}

// Register for an event
async function registerForEvent(req, res, supabase, user) {
  const { eventId, notes, teamMembers } = req.body;
  
  console.log("Register for event called:", { eventId, teamMembers });
  
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  try {
    const userId = user.id;
    console.log(`User ${userId} is registering for event ${eventId}`);
    
    // Get user profile to get username from users table
    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (userProfileError && userProfileError.code !== 'PGRST116') {
      throw userProfileError;
    }
    
    const username = userProfile?.username || user.email;
    console.log(`Username: ${username}`);
    
    // Check if event exists and is open for registration
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      throw eventError;
    }
    
    if (!eventData) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    console.log(`Event data:`, eventData);
    
    // Check if event is open for registration
    if (eventData.status !== 'Upcoming') {
      return res.status(400).json({ 
        message: `Registration is closed for this event. Status: ${eventData.status}` 
      });
    }
    
    // Check if event has reached registration limit
    if (eventData.registration_limit !== null && 
        eventData.registered_count >= eventData.registration_limit) {
      return res.status(400).json({ message: 'Event has reached registration limit' });
    }
    
    // Check if user is already registered
    const { data: existingReg, error: regCheckError } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();
    
    if (existingReg) {
      return res.status(400).json({ message: 'You are already registered for this event' });
    }
    
    // Validate team members if this is a team event
    if (eventData.team_type !== 'solo') {
      // Check if team members are provided for duo/team events
      if (!teamMembers || !Array.isArray(teamMembers) || teamMembers.length === 0) {
        return res.status(400).json({ 
          message: `This is a ${eventData.team_type} event. You must select team members.` 
        });
      }
      
      // For duo events, exactly one team member is required
      if (eventData.team_type === 'duo' && teamMembers.length !== 1) {
        return res.status(400).json({ 
          message: 'For duo events, you must select exactly one team member.' 
        });
      }
      
      // Check if any team members are already registered for this event
      const { data: existingTeamMembers, error: teamCheckError } = await supabase
        .from('event_registrations')
        .select('user_id, username')
        .eq('event_id', eventId)
        .in('user_id', teamMembers.map(member => member.userId));
      
      if (existingTeamMembers && existingTeamMembers.length > 0) {
        const alreadyRegistered = existingTeamMembers.map(member => member.username).join(', ');
        return res.status(400).json({ 
          message: `The following team members are already registered for this event: ${alreadyRegistered}` 
        });
      }
    }
    
    // Register user for the event
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .insert([
        { 
          event_id: eventId,
          user_id: userId,
          username: username,
          notes: notes || null
        }
      ])
      .select()
      .single();
    
    if (regError) {
      throw regError;
    }
    
    // Add team members if this is a team event
    if (eventData.team_type !== 'solo' && teamMembers && teamMembers.length > 0) {
      console.log(`Adding ${teamMembers.length} team members for event ${eventId}`);
      console.log(`Team members:`, teamMembers);
      
      const teamMembersToInsert = teamMembers.map(member => ({
        registration_id: registration.id,
        user_id: member.userId,
        username: member.username
      }));
      
      const { error: teamMemberError } = await supabase
        .from('event_team_members')
        .insert(teamMembersToInsert);
      
      if (teamMemberError) {
        // If there's an error adding team members, delete the registration
        console.error(`Error adding team members:`, teamMemberError);
        
        await supabase
          .from('event_registrations')
          .delete()
          .eq('id', registration.id);
          
        throw new Error(`Failed to add team members: ${teamMemberError.message}`);
      } else {
        console.log(`Successfully added team members for event ${eventId}`);
      }
      
      // For duo events, automatically register the partner as well
      if (eventData.team_type === 'duo') {
        const partner = teamMembers[0];
        
        // Check if the partner is already registered (double-check)
        const { data: partnerReg, error: partnerRegCheckError } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', partner.userId)
          .single();
        
        if (!partnerReg) {
          console.log(`Registering partner ${partner.username} (${partner.userId}) for event ${eventId}`);
          
          // Get the partner's user data to ensure we have their email
          const { data: partnerUserData, error: partnerUserError } = await supabase
            .from('users')
            .select('email')
            .eq('id', partner.userId)
            .single();
            
          if (partnerUserError) {
            console.error('Error fetching partner user data:', partnerUserError);
          } else {
            console.log(`Partner ${partner.username} email: ${partnerUserData?.email || 'Not found'}`);
          }
          
          // Register the partner
          const { data: partnerRegistration, error: partnerRegError } = await supabase
            .from('event_registrations')
            .insert([
              { 
                event_id: eventId,
                user_id: partner.userId,
                username: partner.username,
                notes: `Auto-registered as partner of ${username}`
              }
            ])
            .select()
            .single();
          
          if (partnerRegError) {
            console.error('Error registering partner:', partnerRegError);
            // Continue anyway, as the main registration was successful
          } else {
            console.log(`Successfully registered partner ${partner.username} for event ${eventId}`);
            
            // Add the original user as the partner's team member
            const { error: partnerTeamMemberError } = await supabase
              .from('event_team_members')
              .insert([
                {
                  registration_id: partnerRegistration.id,
                  user_id: userId,
                  username: username
                }
              ]);
            
            if (partnerTeamMemberError) {
              console.error('Error adding team member for partner:', partnerTeamMemberError);
              // Continue anyway
            } else {
              console.log(`Successfully added ${username} as team member for partner ${partner.username}`);
            }
          }
        } else {
          console.log(`Partner ${partner.username} is already registered for event ${eventId}`);
        }
      }
    }
    
    // Get the current count of registrations for this event
    const { count, error: countError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    
    if (!countError) {
      // For duo events, calculate the actual count differently
      // as one duo = 1 spot, not 2 spots
      let finalCount = count;
      
      if (eventData.team_type === 'duo') {
        // Count the number of unique duos (each pair counts as 1)
        const { data: registrations, error: regError } = await supabase
          .from('event_registrations')
          .select('id, notes')
          .eq('event_id', eventId);
          
        if (!regError && registrations) {
          // Count all registrations that aren't auto-registered partners
          const mainRegistrationsCount = registrations.filter(
            reg => !reg.notes || !reg.notes.startsWith('Auto-registered as partner of ')
          ).length;
          
          finalCount = mainRegistrationsCount;
          console.log(`Duo event: Total registrations = ${count}, Main registrations = ${mainRegistrationsCount}`);
        }
      }
      
      // Update the registered_count with the corrected count
      const { data: updatedEvent, error: updateError } = await supabase
        .from('events')
        .update({ registered_count: finalCount })
        .eq('id', eventId)
        .select();
      
      if (updateError) {
        console.error('Error updating event registered count:', updateError);
        // Continue anyway, as the registration was successful
      } else {
        console.log(`Successfully updated event ${eventId} registration count to ${finalCount}`);
      }
    } else {
      console.error('Error counting registrations:', countError);
    }
    
    return res.status(201).json({
      message: `Successfully registered for ${eventData.title}`,
      registration: registration
    });
  } catch (error) {
    console.error('Error registering for event:', error);
    return res.status(500).json({ 
      message: 'Error registering for event', 
      error: error.message 
    });
  }
}

// Cancel registration for an event
async function cancelRegistration(req, res, supabase, user) {
  const { eventId } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  try {
    const userId = user.id;
    
    // Check if event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, registered_count, team_type')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      throw eventError;
    }
    
    if (!eventData) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user is registered for this event
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();
    
    if (regError || !registration) {
      return res.status(400).json({ message: 'You are not registered for this event' });
    }
    
    // For duo events, check if we need to cancel partner's registration too
    if (eventData.team_type === 'duo') {
      // Get the user's team member (partner)
      const { data: teamMembers, error: teamMembersError } = await supabase
        .from('event_team_members')
        .select('user_id')
        .eq('registration_id', registration.id);
      
      if (!teamMembersError && teamMembers && teamMembers.length > 0) {
        const partnerId = teamMembers[0].user_id;
        
        // Find the partner's registration
        const { data: partnerRegistration, error: partnerRegError } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', partnerId)
          .single();
        
        if (!partnerRegError && partnerRegistration) {
          // Delete the partner's team members first
          const { error: partnerTeamDeleteError } = await supabase
            .from('event_team_members')
            .delete()
            .eq('registration_id', partnerRegistration.id);
          
          if (partnerTeamDeleteError) {
            console.error('Error deleting partner team members:', partnerTeamDeleteError);
            // Continue anyway
          }
          
          // Delete the partner's registration
          const { error: partnerDeleteError } = await supabase
            .from('event_registrations')
            .delete()
            .eq('id', partnerRegistration.id);
          
          if (partnerDeleteError) {
            console.error('Error deleting partner registration:', partnerDeleteError);
            // Continue anyway
          } else {
            console.log(`Successfully cancelled partner registration for event ${eventId}`);
          }
        }
      }
    }
    
    // If this is a team event, delete team members first
    if (eventData.team_type !== 'solo') {
      // Delete team members associated with this registration
      const { error: teamDeleteError } = await supabase
        .from('event_team_members')
        .delete()
        .eq('registration_id', registration.id);
      
      if (teamDeleteError) {
        console.error('Error deleting team members:', teamDeleteError);
        // Continue anyway to delete the registration
      }
    }
    
    // Delete the registration
    const { error: deleteError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', registration.id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    // Get the current count of registrations for this event
    const { count, error: countError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    
    if (!countError) {
      // For duo events, calculate the actual count differently
      // as one duo = 1 spot, not 2 spots
      let finalCount = count;
      
      if (eventData.team_type === 'duo') {
        // Count the number of unique duos (each pair counts as 1)
        const { data: registrations, error: regError } = await supabase
          .from('event_registrations')
          .select('id, notes')
          .eq('event_id', eventId);
          
        if (!regError && registrations) {
          // Count all registrations that aren't auto-registered partners
          const mainRegistrationsCount = registrations.filter(
            reg => !reg.notes || !reg.notes.startsWith('Auto-registered as partner of ')
          ).length;
          
          finalCount = mainRegistrationsCount;
          console.log(`Duo event: Total registrations = ${count}, Main registrations = ${mainRegistrationsCount}`);
        }
      }
      
      // Update the registered_count with the corrected count
      const { data: updatedEvent, error: updateError } = await supabase
        .from('events')
        .update({ registered_count: finalCount })
        .eq('id', eventId)
        .select();
      
      if (updateError) {
        console.error('Error updating event registered count:', updateError);
        // Continue anyway, as the registration was cancelled successfully
      } else {
        console.log(`Successfully updated event ${eventId} registration count to ${finalCount}`);
      }
    } else {
      console.error('Error counting registrations:', countError);
    }
    
    return res.status(200).json({
      message: `Successfully cancelled registration for ${eventData.title}`
    });
  } catch (error) {
    console.error('Error cancelling registration:', error);
    return res.status(500).json({ 
      message: 'Error cancelling registration', 
      error: error.message 
    });
  }
}

// Get registration status for an event
async function getRegistrationStatus(req, res, supabase, user) {
  const { eventId } = req.query;
  
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  try {
    const userId = user.id;
    console.log(`Checking registration status for user ${userId} in event ${eventId}`);
    
    // Check if event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      throw eventError;
    }
    
    if (!eventData) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    console.log(`Event team type: ${eventData.team_type}`);
    
    // Check if user is registered for this event
    const { data: registration, error: regError } = await supabase
      .from('event_registrations')
      .select('id, notes')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single();
    
    let isRegistered = !!registration;
    console.log(`User is registered: ${isRegistered}`);
    
    // Get team members if this is a team event and the user is registered
    let teamMembers = [];
    let registeredBy = null;
    
    if (eventData.team_type !== 'solo') {
      console.log(`This is a ${eventData.team_type} event`);
      
      if (isRegistered) {
        console.log(`User ${userId} is registered for ${eventData.team_type} event ${eventId}`);
        
        // Get team members for this user's registration
        const { data: members, error: membersError } = await supabase
          .from('event_team_members')
          .select('user_id, username')
          .eq('registration_id', registration?.id);
        
        if (!membersError && members) {
          teamMembers = members;
          console.log(`Found ${members.length} team members for user ${userId} in event ${eventId}`);
          console.log('Team members:', members);
        }
        
        // Check if this user was registered by someone else (for duo events)
        if (eventData.team_type === 'duo' && registration?.notes) {
          console.log(`Registration notes for user ${userId}: "${registration.notes}"`);
          
          if (registration.notes.startsWith('Auto-registered as partner of ')) {
            registeredBy = registration.notes.replace('Auto-registered as partner of ', '');
            console.log(`User ${userId} was registered by ${registeredBy} for event ${eventId}`);
          }
        }
      } else {
        // Check if user is a team member for someone else's registration
        const { data: teamMemberRegistrations, error: teamMemberError } = await supabase
          .from('event_team_members')
          .select('registration_id, user_id, username')
          .eq('user_id', userId);
        
        if (!teamMemberError && teamMemberRegistrations && teamMemberRegistrations.length > 0) {
          console.log(`User ${userId} is a team member in ${teamMemberRegistrations.length} registrations`);
          
          // For each registration where the user is a team member, check if it's for this event
          for (const teamMemberReg of teamMemberRegistrations) {
            const { data: eventReg, error: eventRegError } = await supabase
              .from('event_registrations')
              .select('id, user_id, username, notes, event_id')
              .eq('id', teamMemberReg.registration_id)
              .eq('event_id', eventId)
              .single();
            
            if (!eventRegError && eventReg) {
              console.log(`Found registration ${eventReg.id} for event ${eventId} where user ${userId} is a team member`);
              console.log(`Registration belongs to user ${eventReg.user_id} (${eventReg.username})`);
              
              // User is a team member for this event
              registeredBy = eventReg.username;
              
              // Get all team members for this registration
              const { data: allTeamMembers, error: allTeamMembersError } = await supabase
                .from('event_team_members')
                .select('user_id, username')
                .eq('registration_id', eventReg.id);
              
              if (!allTeamMembersError && allTeamMembers) {
                teamMembers = allTeamMembers;
                console.log(`Found ${allTeamMembers.length} team members for registration ${eventReg.id}`);
              }
              
              // Set isRegistered to true since the user is part of a team
              isRegistered = true;
              break;
            }
          }
        }
      }
    }
    
    // Get all users for team member selection (if not registered yet)
    let availableTeamMembers = [];
    if (!isRegistered && eventData.team_type !== 'solo') {
      try {
        // Get users who are not already registered for this event
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .neq('id', userId) // Exclude current user
          .order('username');
        
        if (!usersError && users) {
          // Get users who are already registered for this event
          const { data: registeredUsers, error: regUsersError } = await supabase
            .from('event_registrations')
            .select('user_id')
            .eq('event_id', eventId);
          
          // First get all registrations for this event
          const { data: eventRegistrations, error: eventRegError } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('event_id', eventId);
            
          // Then get team members for these registrations
          let teamMembers = [];
          if (!eventRegError && eventRegistrations && eventRegistrations.length > 0) {
            const registrationIds = eventRegistrations.map(reg => reg.id);
            
            const { data: teamMembersData, error: teamMembersError } = await supabase
              .from('event_team_members')
              .select('user_id')
              .in('registration_id', registrationIds);
              
            if (!teamMembersError && teamMembersData) {
              teamMembers = teamMembersData;
            }
          }
          
          if (!regUsersError && registeredUsers) {
            // Create a set of all unavailable user IDs (registered users + team members)
            const unavailableUserIds = new Set(registeredUsers.map(reg => reg.user_id));
            
            // Add team members to the set of unavailable users
            if (teamMembers && teamMembers.length > 0) {
              teamMembers.forEach(member => {
                unavailableUserIds.add(member.user_id);
              });
              console.log(`Found ${teamMembers.length} team members already in the event`);
            }
            
            // Filter out users who are already registered or are team members
            availableTeamMembers = users.filter(user => !unavailableUserIds.has(user.id));
            console.log(`Filtered available team members: ${availableTeamMembers.length} out of ${users.length} total users`);
          } else {
            availableTeamMembers = users;
          }
        }
      } catch (error) {
        console.error('Error fetching available team members:', error);
        // Continue with empty availableTeamMembers array
      }
    }
    
    return res.status(200).json({
      isRegistered,
      registration: registration || null,
      event: eventData,
      teamMembers,
      availableTeamMembers,
      registeredBy
    });
  } catch (error) {
    console.error('Error getting registration status:', error);
    return res.status(500).json({ 
      message: 'Error getting registration status', 
      error: error.message 
    });
  }
} 