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
      .select('username, phone')
      .eq('id', userId)
      .single();
    
    if (userProfileError && userProfileError.code !== 'PGRST116') {
      throw userProfileError;
    }
    
    const username = userProfile?.username || user.email;
    console.log(`Username: ${username}`);
    
    // Check if user has a phone number before allowing registration
    if (!userProfile?.phone || userProfile.phone.trim() === '') {
      return res.status(400).json({ 
        message: 'Phone number verification is required to register for events. Please add a phone number to your profile first.' 
      });
    }
    
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
      
      // Get all team member IDs for easier checking
      const teamMemberIds = teamMembers.map(member => member.userId);
      
      // Start a transaction for concurrent registration check
      // This will ensure that no race condition can occur
      let hasTransactionSupport = true;
      const { error: transactionError } = await supabase.rpc('begin_transaction');
      if (transactionError) {
        // Check if this is just because the function doesn't exist yet
        if (transactionError.code === 'PGRST202') {
          // Silently continue without transaction support
          hasTransactionSupport = false;
        } else {
          // Log other unexpected errors
          console.error('Error starting transaction:', transactionError);
        }
      }
      
      try {
        // Check if any team members are already registered for this event
        const { data: existingTeamMembers, error: teamCheckError } = await supabase
          .from('event_registrations')
          .select('user_id, username')
          .eq('event_id', eventId)
          .in('user_id', teamMemberIds);
        
        if (existingTeamMembers && existingTeamMembers.length > 0) {
          if (hasTransactionSupport) {
            await supabase.rpc('rollback_transaction').catch(() => {
              // Silently handle rollback errors
            });
          }
          const alreadyRegistered = existingTeamMembers.map(member => member.username).join(', ');
          return res.status(400).json({ 
            message: `The following team members are already registered for this event: ${alreadyRegistered}` 
          });
        }
        
        // For duo events, check if the partner is trying to register the current user
        // This prevents the race condition where both users try to register each other
        if (eventData.team_type === 'duo') {
          const partnerId = teamMembers[0].userId;
          
          // Check for pending registrations involving this partner
          // Only do this if we have the event_registration_locks table
          try {
            const { data: pendingRegistrations, error: pendingError } = await supabase
              .from('event_registration_locks')
              .select('*')
              .or(`user_id.eq.${partnerId},partner_id.eq.${userId}`);
            
            if (!pendingError && pendingRegistrations && pendingRegistrations.length > 0) {
              if (hasTransactionSupport) {
                await supabase.rpc('rollback_transaction').catch(() => {
                  // Silently handle rollback errors
                });
              }
              return res.status(409).json({ 
                message: 'This user is currently involved in another registration process. Please try again in a few moments.' 
              });
            }
          } catch (lockError) {
            // If the locks table doesn't exist yet, silently continue
            console.log('Registration locks not supported yet, continuing without lock check');
          }
          
          // Create a registration lock to prevent concurrent registrations
          // Only do this if we have the event_registration_locks table
          try {
            await supabase
              .from('event_registration_locks')
              .insert([{
                user_id: userId,
                partner_id: partnerId,
                event_id: eventId,
                expires_at: new Date(Date.now() + 30000) // Lock for 30 seconds
              }]);
          } catch (lockError) {
            // If the locks table doesn't exist yet, silently continue
            console.log('Registration locks not supported yet, continuing without lock creation');
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
          if (hasTransactionSupport) {
            await supabase.rpc('rollback_transaction').catch(() => {
              // Silently handle rollback errors
            });
          }
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
            
            if (hasTransactionSupport) {
              await supabase.rpc('rollback_transaction').catch(() => {
                // Silently handle rollback errors
              });
            }
            throw new Error(`Failed to add team members: ${teamMemberError.message}`);
          } else {
            console.log(`Successfully added team members for event ${eventId}`);
          }
          
          // For duo events, add partner info to notes instead of creating a separate registration
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
              console.log(`Adding partner ${partner.username} (${partner.userId}) as team member for event ${eventId}`);
              
              // Instead of creating a separate registration for the partner, 
              // we'll just note in the main registration that this is a duo
              const { data: updatedReg, error: updateRegError } = await supabase
                .from('event_registrations')
                .update({ 
                  notes: notes ? `${notes} | Duo partner: ${partner.username}` : `Duo partner: ${partner.username}`
                })
                .eq('id', registration.id)
                .select();
              
              if (updateRegError) {
                console.error('Error updating registration with partner info:', updateRegError);
                if (hasTransactionSupport) {
                  await supabase.rpc('rollback_transaction').catch(() => {
                    // Silently handle rollback errors
                  });
                }
                throw updateRegError;
              } else {
                console.log(`Successfully added partner info to registration for event ${eventId}`);
              }
            } else {
              console.log(`Partner ${partner.username} is already registered for event ${eventId}`);
              if (hasTransactionSupport) {
                await supabase.rpc('rollback_transaction').catch(() => {
                  // Silently handle rollback errors
                });
              }
              return res.status(400).json({ 
                message: `Partner ${partner.username} is already registered for this event` 
              });
            }
          }
        }
        
        // Commit the transaction if successful
        if (hasTransactionSupport) {
          await supabase.rpc('commit_transaction').catch(() => {
            // Silently handle commit errors
          });
        }
        
        // Clean up any registration locks
        if (eventData.team_type === 'duo') {
          try {
            await supabase
              .from('event_registration_locks')
              .delete()
              .eq('user_id', userId);
          } catch (error) {
            // If the locks table doesn't exist yet, silently continue
          }
        }
        
        // Get the current count of registrations for this event
        // Since we no longer create separate records for duo partners,
        // we can use the direct count without special handling
        const { count, error: countError } = await supabase
          .from('event_registrations')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId);
        
        if (!countError) {
          // Update the registered_count with the actual count
          const { data: updatedEvent, error: updateError } = await supabase
            .from('events')
            .update({ registered_count: count })
            .eq('id', eventId)
            .select();
          
          if (updateError) {
            console.error('Error updating event registered count:', updateError);
            // Continue anyway, as the registration was successful
          } else {
            console.log(`Successfully updated event ${eventId} registration count to ${count}`);
          }
        } else {
          console.error('Error counting registrations:', countError);
        }
        
        return res.status(201).json({
          message: `Successfully registered for ${eventData.title}`,
          registration: registration
        });
      } catch (txError) {
        // If anything fails, ensure the transaction is rolled back
        if (hasTransactionSupport) {
          await supabase.rpc('rollback_transaction').catch(() => {
            // Silently handle rollback errors
          });
        }
        console.error('Transaction error during registration:', txError);
        throw txError;
      }
    } else {
      // For solo events (no team members to check)
      
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
      
      // Get the current count of registrations for this event
      const { count, error: countError } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);
      
      if (!countError) {
        // Update the registered_count with the actual count
        const { data: updatedEvent, error: updateError } = await supabase
          .from('events')
          .update({ registered_count: count })
          .eq('id', eventId)
          .select();
        
        if (updateError) {
          console.error('Error updating event registered count:', updateError);
          // Continue anyway, as the registration was successful
        } else {
          console.log(`Successfully updated event ${eventId} registration count to ${count}`);
        }
      } else {
        console.error('Error counting registrations:', countError);
      }
      
      return res.status(201).json({
        message: `Successfully registered for ${eventData.title}`,
        registration: registration
      });
    }
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
    
    // For duo events, we no longer need special handling for cancellation
    // since partners are stored as team members, not separate registrations
    if (eventData.team_type === 'duo') {
      console.log('Cancelling duo registration, team members will be deleted automatically');
      
      // Note: We don't need to look for partner registrations anymore
      // since we're not creating them in the first place
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
      // Update the registered_count with the actual count
      const { data: updatedEvent, error: updateError } = await supabase
        .from('events')
        .update({ registered_count: count })
        .eq('id', eventId)
        .select();
      
      if (updateError) {
        console.error('Error updating event registered count:', updateError);
        // Continue anyway, as the registration was cancelled successfully
      } else {
        console.log(`Successfully updated event ${eventId} registration count to ${count}`);
      }
    } else {
      console.error('Error counting registrations:', countError);
    }
    
    // Force the supabase realtime system to broadcast this delete to all clients
    // This ensures all connected clients get a notification even if they didn't trigger the delete
    await supabase.from('event_registrations').update({ 
      event_id: eventId  // We're just setting the same value to force a change notification
    }).eq('event_id', eventId).is('user_id', null);
    
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
          // Check for the new format of duo partner notes
          else if (registration.notes.includes('Duo partner:')) {
            // This user is the main registrant, so no registeredBy needed
            console.log(`User ${userId} is the main registrant with duo partner note`);
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