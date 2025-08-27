import { createClient } from '@supabase/supabase-js';

// Helper function to debug ID types and formats
function debugId(name, id) {
  return {
    name,
    value: id,
    type: typeof id,
    length: String(id).length,
    isNumeric: !isNaN(Number(id)),
    asNumber: Number(id),
    asString: String(id)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Check if environment variables are set (using server-side variables)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials missing:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        envVars: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
      return res.status(500).json({ error: 'Database configuration error' });
    }

    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!supabase) {
      console.error('Failed to create Supabase client');
      return res.status(500).json({ error: 'Failed to initialize database connection' });
    }

    console.log(`Fetching upcoming matches for user: ${userId}`);

    // Debug: Check events table structure
    const { data: eventSample, error: eventSampleError } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (eventSampleError) {
      console.error('Error checking events table:', eventSampleError);
    } else if (eventSample && eventSample.length > 0) {
      console.log('Events table columns:', Object.keys(eventSample[0]));
    } else {
      console.log('No events found in the database');
    }

    // 1. Get the user information to find their username
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Found user: ${userData.username}`);

    // 2. Get events the user is registered for
    // Note: Using a simpler select first to avoid column errors
    const { data: userRegistrations, error: registrationsError } = await supabase
      .from('event_registrations')
      .select(`
        id, 
        user_id,
        event_id,
        status,
        events (*)
      `)
      .eq('user_id', userId)
      .in('status', ['registered', 'confirmed']);

    // --- NEW: Also get registrations where user is a team member ---
    const { data: teamMemberRegs, error: teamMemberError } = await supabase
      .from('event_team_members')
      .select('registration_id')
      .eq('user_id', userId);
    const teamRegistrationIds = teamMemberRegs?.map(reg => reg.registration_id) || [];
    let teamEventIds = [];
    let teamRegistrations = [];
    if (teamRegistrationIds.length > 0) {
      const { data: teamRegs, error: teamRegsError } = await supabase
        .from('event_registrations')
        .select('id, event_id, status, events (*)')
        .in('id', teamRegistrationIds)
        .in('status', ['registered', 'confirmed']);
      if (teamRegs) {
        teamEventIds = teamRegs.map(reg => reg.event_id);
        teamRegistrations = teamRegs;
      }
    }
    // --- END NEW ---

    // Merge all registrations and event IDs
    const allRegistrations = [...userRegistrations, ...teamRegistrations];
    const allEventIds = allRegistrations.map(reg => reg.event_id);

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return res.status(500).json({ error: 'Failed to fetch registrations: ' + registrationsError.message });
    }

    console.log(`Found ${userRegistrations.length} event registrations`);

    // If we have registrations, log the first one to debug
    if (userRegistrations.length > 0 && userRegistrations[0].events) {
      console.log('First event structure:', Object.keys(userRegistrations[0].events));
    }

    // Filter to only include upcoming or in-progress events
    const relevantRegistrations = allRegistrations.filter(reg => {
      const eventStatus = reg.events?.status?.toLowerCase?.() || '';
      console.log(`Checking event ${reg.event_id} status:`, reg.events?.status, 'Normalized:', eventStatus);
      
      // Check different possible status formats
      const isUpcoming = eventStatus.includes('upcoming') || eventStatus.includes('up coming');
      const isInProgress = 
        eventStatus.includes('in progress') || 
        eventStatus.includes('in_progress') || 
        eventStatus === 'progress' || 
        eventStatus === 'in progress' ||
        reg.events?.status === 'In Progress';
      
      return reg.events && (isUpcoming || isInProgress);
    });

    // Log all user registrations to debug
    console.log('All user registrations:', allRegistrations.map(reg => ({
      id: reg.id,
      eventId: reg.event_id,
      eventStatus: reg.events?.status,
      eventTitle: reg.events?.title
    })));

    console.log(`${relevantRegistrations.length} relevant events (upcoming or in-progress)`);

    if (relevantRegistrations.length === 0) {
      return res.status(200).json({ matches: [] });
    }

    // 3. Get events that have brackets
    const eventIds = relevantRegistrations.map(reg => reg.event_id);
    console.log(`Looking for brackets in events: ${eventIds.join(', ')}`);
    
    const { data: eventBrackets, error: bracketsError } = await supabase
      .from('event_brackets')
      .select('event_id, matches')
      .in('event_id', allEventIds);

    if (bracketsError) {
      console.error('Error fetching brackets:', bracketsError);
      return res.status(500).json({ error: 'Failed to fetch brackets' });
    }

    console.log(`Found brackets for ${eventBrackets?.length || 0} events`);

    if (!eventBrackets || eventBrackets.length === 0) {
      console.log('No brackets found for user events');
      return res.status(200).json({ matches: [] });
    }

    // 4. Get all registrations with team names for proper name display
    const { data: allRegistrationsWithTeams, error: allRegistrationsError } = await supabase
      .from('event_registrations')
      .select(`
        id,
        event_id,
        user_id,
        username,
        team_name,
        event_team_members (
          id,
          user_id,
          username
        )
      `)
      .in('event_id', allEventIds)
      .eq('status', 'registered');

    if (allRegistrationsError) {
      console.error('Error fetching registrations with teams:', allRegistrationsError);
      // Continue anyway, we'll use fallback names
    }

    // Create a lookup map for participant names by registration ID
    const participantNameMap = {};
    if (allRegistrationsWithTeams && allRegistrationsWithTeams.length > 0) {
      allRegistrationsWithTeams.forEach(reg => {
        const eventInfo = relevantRegistrations.find(r => r.event_id === reg.event_id)?.events;
        const eventType = eventInfo?.team_type || 'solo';
        
        let displayName = reg.username; // fallback
        
        if (eventType === 'team' && reg.team_name) {
          displayName = reg.team_name;
        } else if (eventType === 'duo' && reg.team_name) {
          displayName = reg.team_name;
        } else if (eventType === 'duo' && reg.event_team_members && reg.event_team_members.length > 0) {
          // For duo without team name, show both names
          const partner = reg.event_team_members[0];
          displayName = `${reg.username} & ${partner.username}`;
        }
        
        participantNameMap[reg.id] = displayName;
      });
    }

    console.log('Participant name map:', participantNameMap);

    // 5. Get match details for additional information
    const { data: matchDetails, error: matchDetailsError } = await supabase
      .from('event_match_details')
      .select('*')
      .in('event_id', allEventIds);

    if (matchDetailsError) {
      console.error('Error fetching match details:', matchDetailsError);
      // Continue anyway, match details are optional
    }

    console.log(`Found ${matchDetails?.length || 0} match details`);

    // Match details lookup map for quick access
    const matchDetailsMap = {};
    if (matchDetails && matchDetails.length > 0) {
      matchDetails.forEach(detail => {
        matchDetailsMap[`${detail.event_id}_${detail.match_id}`] = detail;
      });
    }

    // 6. Find user's upcoming matches in each bracket
    const upcomingMatches = [];

    // Process each event that has a bracket
    eventBrackets.forEach(bracket => {
      if (!bracket.matches || !Array.isArray(bracket.matches)) {
        console.log(`No valid matches data for event ${bracket.event_id}`);
        return;
      }

      const eventId = bracket.event_id;
      const matchesData = bracket.matches;
      
      // Find the event info
      const eventInfo = relevantRegistrations.find(reg => reg.event_id === eventId)?.events;
      if (!eventInfo) {
        console.log(`No event info found for event ${eventId}`);
        return;
      }

      console.log(`Processing matches for event: ${eventInfo.title} (${eventId})`);

      // Process each round of matches
      matchesData.forEach((round, roundIndex) => {
        if (!Array.isArray(round)) {
          console.log(`Invalid round data at index ${roundIndex} for event ${eventId}`);
          return;
        }

        // Process each match in the round
        round.forEach(match => {
          if (!match || typeof match !== 'object' || !match.id) {
            console.log(`Invalid match data in round ${roundIndex} for event ${eventId}`);
            return;
          }

          // Skip matches that already have a winner
          if (match.winnerId) {
            console.log(`Skipping match #${match.id} in round ${roundIndex + 1} - already has winner: ${match.winnerId}`);
            return;
          }

          // Get user registration for this event
          const userRegistration = allRegistrations.find(reg => reg.event_id === eventId);
          
          // Log the current match to debug
          console.log('Checking match for user participation:', {
            matchId: match.id,
            round: roundIndex + 1,
            participant1Id: match.participant1Id,
            participant2Id: match.participant2Id,
            userRegistrationId: userRegistration?.id,
            isEqual1: match.participant1Id === `${userRegistration?.id}`,
            isEqual2: match.participant2Id === `${userRegistration?.id}`
          });

          if (!userRegistration) {
            console.log(`No registration found for user in event ${eventId}`);
            return;
          }

          // Check if this user is a participant in this match
          // Try different formats of the ID for comparison
          const userRegId = userRegistration.id;
          const userRegIdStr = `${userRegistration.id}`;
          
          console.log('Participant ID debug:', {
            userRegistration: debugId('userRegistration.id', userRegistration.id),
            participant1: debugId('match.participant1Id', match.participant1Id),
            participant2: debugId('match.participant2Id', match.participant2Id)
          });
          
          // Try multiple comparison methods to match IDs by converting both sides to strings
          const isParticipant1 = String(match.participant1Id) === String(userRegistration.id);
          const isParticipant2 = String(match.participant2Id) === String(userRegistration.id);
          
          if (!isParticipant1 && !isParticipant2) {
            console.log(`User is not a participant in match #${match.id}`);
            return;
          } 

          console.log(`User IS a participant in match #${match.id} as ${isParticipant1 ? 'participant1' : 'participant2'}`);

          // If match has TBD participants, see if they depend on previous matches
          let readyToPlay = true;
          if (!match.participant1Id || !match.participant2Id) {
            readyToPlay = false;
          }

          // Get opponent information and user's team name using proper team names
          let opponentName = "TBD";
          let userTeamName = "TBD";
          
          if (isParticipant1) {
            // User is participant 1, opponent is participant 2
            opponentName = participantNameMap[match.participant2Id] || match.participant2Name || "TBD";
            userTeamName = participantNameMap[match.participant1Id] || match.participant1Name || "TBD";
          } else if (isParticipant2) {
            // User is participant 2, opponent is participant 1
            opponentName = participantNameMap[match.participant1Id] || match.participant1Name || "TBD";
            userTeamName = participantNameMap[match.participant2Id] || match.participant2Name || "TBD";
          }

          // Check if match details exist
          const matchDetail = matchDetailsMap[`${eventId}_${match.id}`];
          
          // Add to upcoming matches with flexible event date fields
          // Use various possible date field names in order of preference
          upcomingMatches.push({
            eventId,
            eventTitle: eventInfo.title,
            eventDate: eventInfo.date || eventInfo.event_date || eventInfo.start_date || null,
            eventStatus: eventInfo.status,
            matchId: match.id,
            roundNumber: roundIndex + 1,
            roundName: getRoundName(matchesData.length, roundIndex),
            opponentName,
            userTeamName, // Add user's team name
            isReady: readyToPlay,
            scheduledTime: matchDetail?.scheduled_time || null,
            location: matchDetail?.location || null,
            notes: matchDetail?.notes || null
          });
        });
      });
    });

    console.log(`Found ${upcomingMatches.length} upcoming matches for user`);

    // Sort by scheduled time if available, otherwise by round number
    upcomingMatches.sort((a, b) => {
      if (a.scheduledTime && b.scheduledTime) {
        return new Date(a.scheduledTime) - new Date(b.scheduledTime);
      }
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;
      
      // If no scheduled times, sort by round (earlier rounds first)
      return a.roundNumber - b.roundNumber;
    });
    
    // Return the matches
    return res.status(200).json({ matches: upcomingMatches });
  } catch (error) {
    console.error('Error in upcoming matches:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Helper function to get the round name based on tournament size
function getRoundName(totalRounds, roundIndex) {
  const roundNumber = roundIndex + 1;
  
  // Special case for the final rounds
  if (roundNumber === totalRounds) {
    return 'Final';
  }
  if (roundNumber === totalRounds - 1) {
    return 'Semi-Final';
  }
  if (roundNumber === totalRounds - 2) {
    return 'Quarter-Final';
  }
  
  // Default for early rounds
  return `Round ${roundNumber}`;
} 