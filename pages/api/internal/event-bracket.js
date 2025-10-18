import { createClient } from '@supabase/supabase-js';

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Internal API for event bracket operations
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
    const { action, eventId, bracketData } = req.body;

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
      case 'generate':
        return await handleGenerateBracket(req, res, eventId, supabase);
      case 'get-bracket':
        return await handleGetBracket(req, res, eventId, supabase);
      case 'delete-bracket':
        return await handleDeleteBracket(req, res, eventId, supabase);
      case 'update-match':
        return await handleUpdateMatch(req, res, eventId, bracketData, supabase);
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid action',
          details: 'Action must be one of: generate, get-bracket, delete-bracket, update-match'
        });
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process event bracket request'
    });
  }
}

// Generate bracket
async function handleGenerateBracket(req, res, eventId, supabase) {
  try {
    console.log('[INTERNAL API] Generating bracket for event:', eventId);

    // Get event details
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('id, title, team_type, registration_limit')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      console.error('[INTERNAL API] Event not found:', eventError);
      return res.status(404).json({
        success: false,
        error: 'Event not found',
        message: 'The specified event does not exist'
      });
    }

    // Get registered participants for this event
    const { data: registrationsData, error: registrationsError } = await supabase
      .from('event_registrations')
      .select(`
        id, 
        user_id, 
        status, 
        team_name, 
        notes,
        event_team_members (
          id,
          user_id,
          username
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'registered');

    if (registrationsError) {
      console.error('[INTERNAL API] Error fetching registrations:', registrationsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch registrations',
        message: 'Could not retrieve event registrations'
      });
    }

    // Get user details for each registration
    let participantsData = [];
    if (registrationsData && registrationsData.length > 0) {
      const userIds = registrationsData.map(reg => reg.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', userIds);

      if (usersError) {
        console.error('[INTERNAL API] Error fetching users:', usersError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
          message: 'Could not retrieve user details'
        });
      }

      // Combine registration and user data
      participantsData = registrationsData.map(reg => {
        const user = usersData.find(u => u.id === reg.user_id);
        return {
          id: reg.id,
          user_id: reg.user_id,
          status: reg.status,
          team_name: reg.team_name,
          notes: reg.notes,
          event_team_members: reg.event_team_members,
          users: user || { id: reg.user_id, username: 'Unknown', email: 'unknown@example.com' }
        };
      });
    }

    if (!participantsData || participantsData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No participants',
        message: 'Cannot generate bracket: No registered participants found for this event'
      });
    }

    // Generate a simple bracket structure with proper team names for duo events
    const participants = participantsData.map(p => {
      let displayName = p.users.username; // Default to username
      
      console.log(`[PUBLIC BRACKET GEN] Processing participant ${p.users.username}:`, {
        team_type: eventData.team_type,
        team_name: p.team_name,
        notes: p.notes,
        team_members: p.event_team_members,
        team_members_length: p.event_team_members?.length
      });
      
      // For duo/team events, try to create a team name
      if (eventData.team_type === 'duo' || eventData.team_type === 'team') {
        // First try to use team_name if available
        if (p.team_name) {
          displayName = p.team_name;
          console.log(`[PUBLIC BRACKET GEN] Using team_name: ${displayName}`);
        } 
        // If no team_name, use team members data
        else if (p.event_team_members && p.event_team_members.length > 0) {
          console.log(`[PUBLIC BRACKET GEN] Found team members:`, p.event_team_members);
          // Find the partner (not the main registrant)
          const partner = p.event_team_members.find(member => member.user_id !== p.user_id);
          console.log(`[PUBLIC BRACKET GEN] Partner found:`, partner);
          if (partner) {
            displayName = `${p.users.username} & ${partner.username}`;
            console.log(`[PUBLIC BRACKET GEN] Created team name: ${displayName}`);
          }
        }
        // Fallback: try to extract from notes (e.g., "Duo partner: username")
        else if (p.notes && p.notes.includes('Duo partner:')) {
          const partnerName = p.notes.split('Duo partner:')[1]?.trim();
          if (partnerName) {
            displayName = `${p.users.username} & ${partnerName}`;
            console.log(`[PUBLIC BRACKET GEN] Created team name from notes: ${displayName}`);
          }
        }
      }
      
      console.log(`[PUBLIC BRACKET GEN] Final display name: ${displayName}`);
      
      return {
        id: p.id, // Use registration ID to match participants array
        user_id: p.user_id,
        name: displayName,
        email: p.users.email,
        team_name: p.team_name // Include team_name for champion detection
      };
    });

    // Shuffle participants to create different brackets on regeneration
    const shuffledParticipants = shuffleArray([...participants]);
    
    // Create a simple single-elimination bracket
    const bracket = generateSingleEliminationBracket(shuffledParticipants);

    // Store the bracket in the database
    console.log('[INTERNAL API] Saving bracket to database:', { 
      eventId, 
      bracketLength: bracket.length,
      bracketSample: bracket[0]
    });
    
    // Debug: Log the full bracket structure
    console.log('[INTERNAL API] Full bracket structure:', JSON.stringify(bracket, null, 2));
    
    // First, try to delete any existing bracket for this event
    const { error: deleteError } = await supabase
      .from('event_brackets')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.warn('[INTERNAL API] Warning deleting existing bracket:', deleteError);
    }

    // Then insert the new bracket
    const { data: savedBracket, error: bracketError } = await supabase
      .from('event_brackets')
      .insert({
        event_id: eventId,
        matches: bracket,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (bracketError) {
      console.error('[INTERNAL API] Error saving bracket:', bracketError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save bracket',
        message: `Could not save bracket to database: ${bracketError.message}`
      });
    }

    console.log('[INTERNAL API] Bracket saved successfully:', savedBracket);

    // Update event status to "In Progress" when bracket is generated
    const { error: eventUpdateError } = await supabase
      .from('events')
      .update({
        status: 'In Progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId);
      
    if (eventUpdateError) {
      console.warn('[INTERNAL API] Warning updating event status to In Progress:', eventUpdateError);
    }

    return res.status(200).json({
      success: true,
      bracket: bracket,
      participants: participants,
      event_id: eventId,
      message: 'Bracket generated successfully'
    });

  } catch (error) {
    console.error('[INTERNAL API] Generate bracket error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate bracket',
      message: 'Internal server error'
    });
  }
}

// Helper function to generate a single elimination bracket
function generateSingleEliminationBracket(participants) {
  const numParticipants = participants.length;
  
  if (numParticipants < 2) {
    return [];
  }

  // Calculate number of rounds needed
  const numRounds = Math.ceil(Math.log2(numParticipants));
  
  // Create rounds array
  const rounds = [];
  
  // First round - all participants
  const firstRound = [];
  const firstRoundMatchCount = Math.ceil(numParticipants / 2);
  for (let i = 0; i < numParticipants; i += 2) {
    const participant1 = participants[i];
    const participant2 = participants[i + 1];
    const matchId = Math.floor(i/2) + 1; // Match 1, 2, 3, 4, 5, 6, 7, 8
    // Calculate next match ID: first round matches connect to second round
    // Match 1,2 -> Match 5; Match 3,4 -> Match 6; etc.
    const nextMatchId = numRounds > 1 ? firstRoundMatchCount + Math.floor((matchId - 1) / 2) + 1 : null;
    
    const match = {
      id: matchId,
      participant1Id: participant1?.id || null,
      participant2Id: participant2?.id || null,
      participant1Name: participant1?.name || null,
      participant2Name: participant2?.name || null,
      winnerId: null,
      status: 'pending',
      round: 1,
      nextMatchId: nextMatchId,
      scheduledTime: null,
      location: '',
      notes: ''
    };
    firstRound.push(match);
  }
  rounds.push(firstRound);

  // Subsequent rounds
  let currentMatchId = firstRoundMatchCount + 1; // Start after first round
  
  for (let round = 1; round < numRounds; round++) {
    const prevRound = rounds[round - 1];
    const currentRound = [];
    const numMatches = Math.ceil(prevRound.length / 2);
    
    for (let i = 0; i < numMatches; i++) {
      // Calculate match ID: sequential numbering starting after first round
      // Round 2: 5, 6 (for 8 participants)
      // Round 3: 7 (for 8 participants)  
      // Round 4: 8 (for 8 participants)
      const matchId = currentMatchId++;
      const isLastRound = round === numRounds - 1;
      // Calculate next match ID for subsequent rounds
      // For Round 2: matches 9,10,11,12 -> 9,10 point to 13; 11,12 point to 14
      // For Round 3: matches 13,14 -> both point to 15 (final)
      // Calculate total matches up to current round + 1 for next round start
      let totalMatchesUpToCurrentRound = firstRoundMatchCount;
      for (let r = 1; r <= round; r++) {
        totalMatchesUpToCurrentRound += Math.ceil(Math.pow(2, numRounds - r - 1));
      }
      const nextMatchId = isLastRound ? null : totalMatchesUpToCurrentRound + 1 + Math.floor(i / 2);
      
      const match = {
        id: matchId,
        participant1Id: null,
        participant2Id: null,
        participant1Name: null,
        participant2Name: null,
        winnerId: null,
        status: 'pending',
        round: round + 1,
        nextMatchId: nextMatchId,
        scheduledTime: null,
        location: '',
        notes: ''
      };
      currentRound.push(match);
    }
    rounds.push(currentRound);
  }

  return rounds;
}

// Get bracket
async function handleGetBracket(req, res, eventId, supabase) {
  try {
    console.log('[INTERNAL API] Fetching bracket for eventId:', eventId, 'type:', typeof eventId);
    
    // Convert eventId to integer if it's a string
    const numericEventId = parseInt(eventId);
    if (isNaN(numericEventId)) {
      console.error('[INTERNAL API] Invalid eventId:', eventId);
      return res.status(400).json({ 
        success: false,
        error: 'Invalid event ID',
        details: 'Event ID must be a number'
      });
    }
    
    // First check if the event exists
    const { error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', numericEventId)
      .single();

    if (eventError) {
      console.error('[INTERNAL API] Error fetching event:', eventError);
      return res.status(404).json({ 
        success: false,
        error: 'Event not found',
        details: eventError.message 
      });
    }

    // Get the bracket data
    const { data: bracketData, error: bracketError } = await supabase
      .from('event_brackets')
      .select('*')
      .eq('event_id', numericEventId)
      .single();

    if (bracketError) {
      if (bracketError.code === 'PGRST116') {
        // No bracket found - this is not an error, but we should still return participants
        console.log('[INTERNAL API] No bracket found for event:', numericEventId);
        
        // Fetch participants for this event even if no bracket exists
        const { data: registrationsData, error: registrationsError } = await supabase
          .from('event_registrations')
          .select('id, user_id, status, team_name, notes')
          .eq('event_id', numericEventId)
          .eq('status', 'registered');

        let participantsData = [];
        if (!registrationsError && registrationsData && registrationsData.length > 0) {
          // Get user details for each registration
          const userIds = registrationsData.map(reg => reg.user_id);
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, username, email')
            .in('id', userIds);

          if (!usersError && usersData) {
            // Combine registration and user data
            participantsData = registrationsData.map(reg => {
              const user = usersData.find(u => u.id === reg.user_id);
              return {
                id: reg.id,
                user_id: reg.user_id,
                status: reg.status,
                team_name: reg.team_name,
                notes: reg.notes,
                users: user || { id: reg.user_id, username: 'Unknown', email: 'unknown@example.com' }
              };
            });
          }
        }
        
        return res.status(404).json({ 
          success: true,
          message: 'No bracket found',
          bracket: null,
          participants: participantsData,
          event_id: numericEventId
        });
      }
      console.error('[INTERNAL API] Error fetching bracket:', bracketError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch bracket',
        details: bracketError.message 
      });
    }

    // Parse bracket data if it's stored as JSON
    let parsedBracket = null;
    if (bracketData.matches) {
      try {
        parsedBracket = typeof bracketData.matches === 'string' 
          ? JSON.parse(bracketData.matches) 
          : bracketData.matches;
        
        // Handle both old and new bracket structures
        if (parsedBracket && typeof parsedBracket === 'object' && parsedBracket.rounds) {
          // Old structure: { rounds: [...], participants: [...], type: '...' }
          console.log('[INTERNAL API] Converting old bracket structure to new format');
          parsedBracket = parsedBracket.rounds;
        }
        
        // Ensure it's an array
        if (!Array.isArray(parsedBracket)) {
          console.error('[INTERNAL API] Parsed bracket is not an array:', parsedBracket);
          parsedBracket = [];
        }
      } catch (parseError) {
        console.error('[INTERNAL API] Error parsing bracket data:', parseError);
        parsedBracket = [];
      }
    } else {
      parsedBracket = [];
    }

    console.log('[INTERNAL API] Bracket found:', { bracketData, parsedBracket });
    
    // Also fetch participants for this event
    const { data: registrationsData, error: registrationsError } = await supabase
      .from('event_registrations')
      .select('id, user_id, status, team_name, notes')
      .eq('event_id', numericEventId)
      .eq('status', 'registered');

    let participantsData = [];
    if (!registrationsError && registrationsData && registrationsData.length > 0) {
      // Get user details for each registration
      const userIds = registrationsData.map(reg => reg.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, email')
        .in('id', userIds);

      if (!usersError && usersData) {
        // Combine registration and user data
        participantsData = registrationsData.map(reg => {
          const user = usersData.find(u => u.id === reg.user_id);
          return {
            id: reg.id,
            user_id: reg.user_id,
            status: reg.status,
            team_name: reg.team_name,
            notes: reg.notes,
            users: user || { id: reg.user_id, username: 'Unknown', email: 'unknown@example.com' }
          };
        });
      }
    }

    console.log('[INTERNAL API] Returning bracket with participants:', {
      bracketLength: parsedBracket?.length || 0,
      participantsCount: participantsData.length,
      participantsSample: participantsData.slice(0, 2) // Show first 2 participants
    });

    return res.status(200).json({ 
      success: true,
      bracket: parsedBracket || [],
      participants: participantsData
    });
    
  } catch (error) {
    console.error('[INTERNAL API] Get bracket error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bracket',
      message: 'Internal server error',
      details: error.message
    });
  }
}

// Delete bracket
async function handleDeleteBracket(req, res, eventId, supabase) {
  try {
    console.log('[INTERNAL API] Deleting bracket for event:', eventId);

    // Delete the bracket from the database
    const { error: deleteError } = await supabase
      .from('event_brackets')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('[INTERNAL API] Error deleting bracket:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete bracket',
        message: 'Could not delete bracket from database'
      });
    }

    console.log('[INTERNAL API] Bracket deleted successfully');
    return res.status(200).json({
      success: true,
      message: 'Bracket deleted successfully'
    });

  } catch (error) {
    console.error('[INTERNAL API] Delete bracket error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete bracket',
      message: 'Internal server error'
    });
  }
}

// Update match
async function handleUpdateMatch(req, res, eventId, bracketData, supabase) {
  try {
    const { matchId, winnerId } = bracketData;
    console.log('[INTERNAL API] Updating match:', { matchId, winnerId, eventId });

    // First, get the current bracket data
    const { data: currentBracket, error: getError } = await supabase
      .from('event_brackets')
      .select('matches')
      .eq('event_id', eventId)
      .single();

    if (getError || !currentBracket) {
      console.error('[INTERNAL API] Error getting current bracket:', getError);
      return res.status(404).json({
        success: false,
        error: 'Bracket not found',
        message: 'Could not find bracket to update'
      });
    }

    // Parse the current bracket data
    let currentMatches = currentBracket.matches;
    if (typeof currentMatches === 'string') {
      currentMatches = JSON.parse(currentMatches);
    }

    // Handle both old and new bracket structures
    if (currentMatches && typeof currentMatches === 'object' && currentMatches.rounds) {
      currentMatches = currentMatches.rounds;
    }

    if (!Array.isArray(currentMatches)) {
      console.error('[INTERNAL API] Invalid bracket structure:', currentMatches);
      return res.status(500).json({
        success: false,
        error: 'Invalid bracket structure',
        message: 'Bracket data is not in expected format'
      });
    }

    // Find and update the specific match
    let matchFound = false;
    let currentMatch = null;
    const updatedMatches = currentMatches.map(round => 
      round.map(match => {
        if (match.id === matchId) {
          matchFound = true;
          currentMatch = match;
          return {
            ...match,
            winnerId: winnerId,
            status: 'completed'
          };
        }
        return match;
      })
    );

    if (!matchFound || !currentMatch) {
      console.error('[INTERNAL API] Match not found:', matchId);
      return res.status(404).json({
        success: false,
        error: 'Match not found',
        message: `Match with ID ${matchId} not found in bracket`
      });
    }

    // Advance winner to next match if there is one
    if (currentMatch.nextMatchId) {
      console.log('[INTERNAL API] Advancing winner to next match:', currentMatch.nextMatchId);
      
      // Get winner information
      const winnerName = winnerId === currentMatch.participant1Id ? 
        currentMatch.participant1Name : 
        currentMatch.participant2Name;
      
      // Find and update the next match
      const finalMatches = updatedMatches.map(round => 
        round.map(match => {
          if (match.id === currentMatch.nextMatchId) {
            console.log('[INTERNAL API] Updating next match with winner:', { winnerId, winnerName });
            
            // Determine which participant slot to fill
            const isFirstSlot = match.participant1Id === null;
            return {
              ...match,
              participant1Id: isFirstSlot ? winnerId : match.participant1Id,
              participant2Id: isFirstSlot ? match.participant2Id : winnerId,
              participant1Name: isFirstSlot ? winnerName : match.participant1Name,
              participant2Name: isFirstSlot ? match.participant2Name : winnerName,
              status: 'pending' // Reset status for the next match
            };
          }
          return match;
        })
      );
      
      // Use the final matches with advancement
      updatedMatches.splice(0, updatedMatches.length, ...finalMatches);
    }

    // Update the bracket data in the database
    const { error: updateError } = await supabase
      .from('event_brackets')
      .update({
        matches: updatedMatches,
        updated_at: new Date().toISOString()
      })
      .eq('event_id', eventId);

    // Check if this was the final match and update event status
    if (!currentMatch.nextMatchId) {
      console.log('[INTERNAL API] Final match completed, updating event status to Completed');
      
      const { error: eventUpdateError } = await supabase
        .from('events')
        .update({
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);
        
      if (eventUpdateError) {
        console.warn('[INTERNAL API] Warning updating event status:', eventUpdateError);
      }
    }

    if (updateError) {
      console.error('[INTERNAL API] Error updating bracket:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update bracket',
        message: 'Could not update bracket in database'
      });
    }

    return res.status(200).json({
      success: true,
      result: {
        bracket: updatedMatches
      },
      message: 'Match updated successfully'
    });

  } catch (error) {
    console.error('[INTERNAL API] Update match error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update match',
      message: 'Internal server error'
    });
  }
}

export default handler;