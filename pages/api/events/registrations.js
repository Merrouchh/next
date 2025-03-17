import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  console.log("Event registrations API endpoint called:", req.method);
  
  try {
    // Create authenticated Supabase client
    const supabase = createClient(req, res);
    
    // Check if user is authenticated - using getUser for better security
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    
    console.log("User exists:", !!user);
    
    if (userError || !user) {
      console.log("Authentication failed:", userError?.message || "No user");
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      });
    }
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getEventRegistrations(req, res, supabase, user);
      case 'DELETE':
        return await removeRegistration(req, res, supabase, user);
      default:
        res.setHeader('Allow', ['GET', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

/**
 * Get registrations for an event
 */
async function getEventRegistrations(req, res, supabase, user) {
  const { eventId } = req.query;
  
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }
  
  try {
    // Check if user is admin - using users table instead of profiles
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.status(500).json({ message: 'Error fetching user data' });
    }
    
    const isAdmin = userData?.is_admin || false;
    
    // Check if event exists
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, date, time, location, status, registration_limit, registered_count, team_type')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Normalize team_type field to ensure consistent casing
    if (eventData.team_type) {
      console.log("Original team_type:", eventData.team_type);
      eventData.team_type = eventData.team_type.trim().toLowerCase();
      console.log("Normalized team_type:", eventData.team_type);
    } else {
      // Set default team_type if missing
      eventData.team_type = 'solo';
      console.log("Set default team_type to 'solo'");
    }
    
    // Get the actual count of registrations
    console.log('Counting registrations for event ID:', eventId);
    const { count: actualRegistrationCount, error: countError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    
    console.log('Actual registration count:', actualRegistrationCount, 'Error:', countError);
    console.log('Current event registered_count:', eventData.registered_count);
    
    if (!countError && actualRegistrationCount !== null) {
      // Update the event data with the actual count
      console.log('Updating event data with actual count:', actualRegistrationCount);
      eventData.registered_count = actualRegistrationCount;
      
      // If the count in the database is wrong, update it
      if (eventData.registered_count !== actualRegistrationCount) {
        console.log('Updating database count from', eventData.registered_count, 'to', actualRegistrationCount);
        const { error: updateError } = await supabase
          .from('events')
          .update({ registered_count: actualRegistrationCount })
          .eq('id', eventId);
        
        if (updateError) {
          console.error('Error updating event registration count:', updateError);
        } else {
          console.log('Successfully updated event registration count in database');
        }
      }
    }
    
    // If user is not admin, only return their registration status
    if (!isAdmin) {
      const { data: registrationData, error: registrationError } = await supabase
        .from('event_registrations')
        .select('id, registration_date, username, status, notes')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single();
      
      // Format the registration date if it exists
      const formattedDate = registrationData?.registration_date 
        ? new Date(registrationData.registration_date).toLocaleString() 
        : null;
      
      return res.status(200).json({
        isRegistered: !registrationError && registrationData !== null,
        registration: registrationData ? {
          ...registrationData,
          registration_date_formatted: formattedDate
        } : null,
        event: {
          id: eventData.id,
          title: eventData.title,
          registeredCount: eventData.registered_count || 0,
          registrationLimit: eventData.registration_limit,
          teamType: eventData.team_type
        }
      });
    }
    
    // If user is admin, return all registrations
    const { data: registrationsData, error: registrationsError } = await supabase
      .from('event_registrations')
      .select(`
        id,
        user_id,
        event_id,
        username,
        registration_date,
        status,
        notes
      `)
      .eq('event_id', eventId)
      .order('registration_date', { ascending: false });
    
    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return res.status(500).json({ message: 'Error fetching registrations' });
    }
    
    // Fetch user details separately if there are registrations
    let usersData = [];
    if (registrationsData && registrationsData.length > 0) {
      const userIds = registrationsData.map(reg => reg.user_id);
      
      // Directly query the public.users table which has the email information
      console.log('Fetching user details for IDs:', userIds);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, username')
        .in('id', userIds);
      
      if (!usersError && users && users.length > 0) {
        usersData = users;
        console.log('Successfully fetched user details:', users);
      } else {
        console.error('Error fetching user details from users table:', usersError);
      }
      
      // Add the current user's email if they're in the registrations
      // This ensures at least the current user's email is available
      if (user && userIds.includes(user.id) && user.email) {
        const existingUserData = usersData.find(u => u.id === user.id);
        if (existingUserData) {
          existingUserData.email = user.email;
        } else {
          usersData.push({
            id: user.id,
            email: user.email,
            username: user.user_metadata?.username || null,
            avatar_url: null
          });
        }
      }
    }
    
    // Fetch team members for each registration if this is a team or duo event
    let teamMembersData = {};
    let partnerRelationships = {};
    
    if (eventData.team_type !== 'solo' && registrationsData && registrationsData.length > 0) {
      const registrationIds = registrationsData.map(reg => reg.id);
      
      // Get all team members for these registrations
      const { data: teamMembers, error: teamMembersError } = await supabase
        .from('event_team_members')
        .select('registration_id, user_id, username')
        .in('registration_id', registrationIds);
      
      if (!teamMembersError && teamMembers && teamMembers.length > 0) {
        // Group team members by registration_id
        teamMembers.forEach(member => {
          if (!teamMembersData[member.registration_id]) {
            teamMembersData[member.registration_id] = [];
          }
          teamMembersData[member.registration_id].push(member);
        });
        console.log('Successfully fetched team members:', teamMembers);
        
        // Fetch user data for team members to get their emails
        if (teamMembers.length > 0) {
          const teamMemberUserIds = teamMembers.map(member => member.user_id);
          
          // Get user data for team members
          const { data: teamMemberUsers, error: teamMemberUsersError } = await supabase
            .from('users')
            .select('id, email, username')
            .in('id', teamMemberUserIds);
          
          if (!teamMemberUsersError && teamMemberUsers && teamMemberUsers.length > 0) {
            console.log('Successfully fetched team member user data:', teamMemberUsers);
            
            // Add email information to team members
            teamMembers.forEach(member => {
              const userData = teamMemberUsers.find(user => user.id === member.user_id);
              if (userData) {
                member.email = userData.email;
              }
            });
          } else {
            console.error('Error fetching team member user data:', teamMemberUsersError);
          }
        }
        
        // For duo events, create a mapping of partners
        if (eventData.team_type === 'duo') {
          // Create a map of registration IDs to usernames
          const registrationUserMap = {};
          registrationsData.forEach(reg => {
            registrationUserMap[reg.id] = reg.username;
          });
          
          // For each team member, find the registration it belongs to
          teamMembers.forEach(member => {
            const registrantUsername = registrationUserMap[member.registration_id];
            if (registrantUsername) {
              // Find the registration for this team member's user_id
              const partnerRegistration = registrationsData.find(reg => 
                reg.user_id === member.user_id
              );
              
              if (partnerRegistration) {
                partnerRelationships[partnerRegistration.id] = {
                  registeredBy: registrantUsername,
                  registrationId: member.registration_id,
                  email: member.email // Add email to the relationship data
                };
              }
            }
          });
        }
      } else {
        console.error('Error fetching team members:', teamMembersError);
      }
    }
    
    // Combine registration data with user data and team members
    const registrationsWithUserData = registrationsData.map(registration => {
      // Find the user data from the users table
      const userData = usersData.find(user => user.id === registration.user_id);
      
      // Format the registration date if it exists
      const formattedDate = registration.registration_date 
        ? new Date(registration.registration_date).toLocaleString() 
        : 'Invalid Date';
      
      // Check if this user was registered by someone else (for duo events)
      let registeredBy = null;
      let isPartner = false;
      let partnerEmail = null;
      
      // First check the notes field for auto-registered partners
      if (eventData.team_type === 'duo' && registration.notes) {
        if (registration.notes.startsWith('Auto-registered as partner of ')) {
          registeredBy = registration.notes.replace('Auto-registered as partner of ', '');
          isPartner = true;
          console.log(`Found partner from notes: ${registration.username} registered by ${registeredBy}`);
        }
      }
      
      // Then check our partner relationships map for additional information
      if (eventData.team_type === 'duo' && partnerRelationships[registration.id]) {
        registeredBy = partnerRelationships[registration.id].registeredBy;
        partnerEmail = partnerRelationships[registration.id].email;
        isPartner = true;
        console.log(`Found partner from relationships map: ${registration.username} registered by ${registeredBy}`);
        if (partnerEmail) {
          console.log(`Partner ${registration.username} has email: ${partnerEmail}`);
        }
      }
      
      // For duo events, if we have team members, this is likely a main registrant
      if (eventData.team_type === 'duo' && teamMembersData[registration.id] && teamMembersData[registration.id].length > 0) {
        console.log(`${registration.username} has team members, marking as main registrant`);
        isPartner = false;
      }
      
      return {
        ...registration,
        registration_date_formatted: formattedDate,
        user: {
          id: registration.user_id,
          // Use email from users table if available, or partner email if this is a partner
          email: partnerEmail || userData?.email || 'No email found',
          // Use username from registration record as it's more reliable
          username: registration.username || userData?.username || 'Unknown User',
          // We don't have avatar_url yet
          avatar_url: null
        },
        // Add team information
        teamMembers: teamMembersData[registration.id] || [],
        registeredBy,
        isPartner,
        registrationType: isPartner ? 'partner' : 'main'
      };
    });
    
    // For duo events, ensure we have proper partner relationships
    if (eventData.team_type === 'duo') {
      // Find main registrants and their partners
      const mainRegistrants = registrationsWithUserData.filter(reg => !reg.isPartner);
      const partners = registrationsWithUserData.filter(reg => reg.isPartner);
      
      console.log(`After processing: ${mainRegistrants.length} main registrants and ${partners.length} partners`);
      
      // If we have unlinked partners, try to match them with main registrants
      if (partners.some(p => !p.registeredBy) && mainRegistrants.length > 0) {
        console.log('Found unlinked partners, attempting to match with main registrants');
        
        partners.forEach(partner => {
          if (!partner.registeredBy) {
            // Find a main registrant that has this user as a team member
            const matchingMain = mainRegistrants.find(main => 
              main.teamMembers.some(member => member.user_id === partner.user_id)
            );
            
            if (matchingMain) {
              partner.registeredBy = matchingMain.username;
              partner.isPartner = true;
              console.log(`Matched partner ${partner.username} with main registrant ${matchingMain.username}`);
            }
          }
        });
      }
      
      // Create virtual partner registrations for main registrants who have team members but no partner registration
      mainRegistrants.forEach(main => {
        if (main.teamMembers && main.teamMembers.length > 0) {
          // Check if the team member has a corresponding partner registration
          const teamMember = main.teamMembers[0]; // In duo events, there should be only one team member
          const existingPartner = partners.find(p => p.user_id === teamMember.user_id);
          
          if (!existingPartner) {
            console.log(`Creating virtual partner registration for team member ${teamMember.username}`);
            
            // Find the user data for this team member to get their email
            const teamMemberUserData = usersData.find(u => u.id === teamMember.user_id);
            
            // Create a virtual partner registration
            const virtualPartner = {
              id: `virtual-${main.id}-${teamMember.user_id}`,
              user_id: teamMember.user_id,
              event_id: eventData.id,
              username: teamMember.username,
              registration_date: main.registration_date,
              registration_date_formatted: main.registration_date_formatted,
              status: 'registered',
              notes: `Auto-registered as partner of ${main.username}`,
              user: {
                id: teamMember.user_id,
                email: teamMember.email || teamMemberUserData?.email || 'No email found',
                username: teamMember.username,
                avatar_url: null
              },
              teamMembers: [{
                registration_id: main.id,
                user_id: main.user_id,
                username: main.username
              }],
              registeredBy: main.username,
              isPartner: true,
              registrationType: 'partner'
            };
            
            // Add the virtual partner to the registrations
            registrationsWithUserData.push(virtualPartner);
            partners.push(virtualPartner);
            
            console.log(`Added virtual partner: ${virtualPartner.username} with email: ${virtualPartner.user.email}`);
          }
        }
      });
    }
    // For team events, ensure all team members have proper email information
    else if (eventData.team_type === 'team') {
      console.log('Processing team event registrations');
      
      // Find all main registrants (team leaders)
      const teamLeaders = registrationsWithUserData.filter(reg => 
        reg.teamMembers && reg.teamMembers.length > 0
      );
      
      console.log(`Found ${teamLeaders.length} team leaders with team members`);
      
      // Enhance team member data with email information
      teamLeaders.forEach(leader => {
        if (leader.teamMembers && leader.teamMembers.length > 0) {
          console.log(`Processing team members for leader ${leader.username} (${leader.id})`);
          
          // Update each team member with email information
          leader.teamMembers.forEach(member => {
            // Find user data for this team member
            const memberUserData = usersData.find(u => u.id === member.user_id);
            
            if (memberUserData && memberUserData.email) {
              member.email = memberUserData.email;
              console.log(`Added email ${memberUserData.email} to team member ${member.username}`);
            } else {
              console.log(`No email found for team member ${member.username}`);
            }
            
            // Add additional information to team member
            member.registeredBy = leader.username;
            member.isTeamMember = true;
          });
          
          // Sort team members by username for consistent display
          leader.teamMembers.sort((a, b) => a.username.localeCompare(b.username));
          
          // Mark this registration as a team leader
          leader.isTeamLeader = true;
          leader.registrationType = 'team_leader';
        }
      });
    }
    
    console.log('Registrations with user data:', JSON.stringify(registrationsWithUserData, null, 2));
    
    return res.status(200).json({
      event: eventData,
      registrations: registrationsWithUserData
    });
  } catch (error) {
    console.error('Error in getEventRegistrations:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Remove a registration
 */
async function removeRegistration(req, res, supabase, user) {
  const { registrationId, eventId } = req.body;
  
  if (!registrationId || !eventId) {
    return res.status(400).json({ message: 'Registration ID and Event ID are required' });
  }
  
  try {
    // Check if user is admin - using users table instead of profiles
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user data:', userError);
      return res.status(500).json({ message: 'Error fetching user data' });
    }
    
    const isAdmin = userData?.is_admin || false;
    
    // Get the registration to check if it belongs to the current user
    const { data: registrationData, error: registrationError } = await supabase
      .from('event_registrations')
      .select('user_id, event_id')
      .eq('id', registrationId)
      .single();
    
    if (registrationError) {
      console.error('Error fetching registration:', registrationError);
      return res.status(404).json({ message: 'Registration not found' });
    }
    
    // Only allow admin or the registration owner to delete
    if (!isAdmin && registrationData.user_id !== user.id) {
      return res.status(403).json({ message: 'Unauthorized to remove this registration' });
    }
    
    // Delete the registration
    const { error: deleteError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('id', registrationId);
    
    if (deleteError) {
      console.error('Error deleting registration:', deleteError);
      return res.status(500).json({ message: 'Error removing registration' });
    }
    
    // Get the current count of registrations for this event
    const { count, error: countError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);
    
    if (!countError) {
      // Update the registered_count directly
      const { error: updateError } = await supabase
        .from('events')
        .update({ registered_count: count })
        .eq('id', eventId);
      
      if (updateError) {
        console.error('Error updating event registration count:', updateError);
        // Continue anyway, as the registration was deleted successfully
      } else {
        console.log(`Successfully updated event ${eventId} registration count to ${count}`);
      }
    } else {
      console.error('Error counting registrations:', countError);
    }
    
    return res.status(200).json({ 
      message: 'Registration removed successfully',
      registrationId
    });
  } catch (error) {
    console.error('Error in removeRegistration:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 