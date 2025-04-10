import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Initialize Supabase with anon key - no auth for public endpoints
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { id } = req.query;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // GET requests can be public
        return await getBracket(req, res, supabase, eventId);
      case 'POST':
      case 'PUT':
      case 'DELETE':
        // POST, PUT, and DELETE requests require authentication
        return await handleAuthenticatedRequest(req, res, supabase, eventId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unhandled error in bracket API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Function to handle authenticated requests
async function handleAuthenticatedRequest(req, res, supabase, eventId) {
  // Create authenticated client with token from request
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

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Handle the authenticated request based on the method
  switch (req.method) {
    case 'POST':
      return await generateBracket(req, res, authenticatedSupabase, eventId, user);
    case 'PUT':
      return await updateBracket(req, res, authenticatedSupabase, eventId, user);
    case 'DELETE':
      return await deleteBracket(req, res, authenticatedSupabase, eventId, user);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Get existing bracket for an event - no authentication required
async function getBracket(req, res, supabase, eventId) {
  try {
    // Disable caching to ensure fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // First check if the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get the bracket data
    const { data: bracketData, error: bracketError } = await supabase
      .from('event_brackets')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (bracketError && bracketError.code !== 'PGRST116') {
      console.error('Error fetching bracket:', bracketError);
      return res.status(500).json({ error: 'Failed to fetch bracket data' });
    }

    if (!bracketData) {
      return res.status(404).json({ error: 'Bracket not found for this event' });
    }

    // Get participants from registrations
    const { data: registrations, error: registrationsError } = await supabase
      .from('event_registrations')
      .select(`
        id, 
        user_id, 
        username,
        event_team_members (
          id,
          user_id,
          username
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'registered');

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return res.status(500).json({ error: 'Failed to fetch participants' });
    }

    // Format participants for response
    const participants = registrations.map(reg => {
      console.log(`Processing registration for ${reg.username}, team_type: ${event.team_type}`);
      
      if (event.team_type === 'solo') {
        return {
          id: reg.id.toString(),
          name: reg.username,
          userId: reg.user_id
        };
      } else {
        // For duo or team, include team members
        const teamMembers = reg.event_team_members || [];
        console.log(`Found ${teamMembers.length} team members for ${reg.username}:`, teamMembers);
        
        return {
          id: reg.id.toString(),
          name: reg.username, // Team captain/name
          userId: reg.user_id,
          members: teamMembers.map(member => ({
            id: member.id.toString(),
            name: member.username,
            userId: member.user_id
          }))
        };
      }
    });

    return res.status(200).json({
      bracket: bracketData.matches,
      participants,
      eventType: event.team_type
    });
  } catch (error) {
    console.error('Error in getBracket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate a new bracket for an event - requires authentication and admin privileges
async function generateBracket(req, res, supabase, eventId, user) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!userData.is_admin) {
      return res.status(403).json({ error: 'Only admins can generate brackets' });
    }

    // Check if a bracket already exists for this event
    const { data: existingBracket, error: bracketCheckError } = await supabase
      .from('event_brackets')
      .select('id')
      .eq('event_id', eventId)
      .single();

    // If bracket exists and force parameter is not set to true, return error
    const forceRegenerate = req.body && req.body.force === true;
    
    if (!bracketCheckError && existingBracket && !forceRegenerate) {
      return res.status(409).json({ error: 'Bracket already exists for this event', bracketId: existingBracket.id });
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('registration_limit, team_type')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get registrations for this event with both confirmed and registered statuses
    const { data: registrations, error: regError } = await supabase
      .from('event_registrations')
      .select(`
        id, 
        username, 
        user_id, 
        event_team_members (
          id,
          username,
          user_id
        )
      `)
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'registered']);

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return res.status(500).json({ error: 'Failed to fetch registrations' });
    }

    if (!registrations || registrations.length === 0) {
      // If no registrations found, check the users table for test participants
      const { data: testUsers, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .not('username', 'eq', 'admin')
        .limit(16);
        
      if (usersError || !testUsers || testUsers.length === 0) {
      return res.status(400).json({ error: 'No participants registered for this event' });
      }
      
      // Use test users if available (for development and testing)
      console.log(`Using ${testUsers.length} test users as participants for event ${eventId}`);
      
      // Format test users as participants
      const testParticipants = testUsers.map(user => ({
        id: user.id.toString(),
        username: user.username,
        user_id: user.id
      }));
      
      // Use test participants instead of registrations
      registrations.push(...testParticipants);
    }

    // Shuffle participants for random seeding
    const shuffledParticipants = shuffleArray([...registrations]);
    
    // Generate bracket structure based on registration_limit or actual participants
    const bracketSize = event.registration_limit || registrations.length;
    const bracketData = generateTournamentBracket(shuffledParticipants, bracketSize);

    // If a bracket already exists, delete it first
    if (existingBracket) {
      const { error: deleteError } = await supabase
        .from('event_brackets')
        .delete()
        .eq('id', existingBracket.id);
      
      if (deleteError) {
        console.error('Error deleting existing bracket:', deleteError);
        return res.status(500).json({ error: 'Failed to replace existing bracket' });
      }
    }

    // Save bracket to database
    const { data: savedBracket, error: saveError } = await supabase
      .from('event_brackets')
      .insert([
        {
          event_id: eventId,
          matches: bracketData
        }
      ])
      .select()
      .single();

    if (saveError) {
      console.error('Error saving bracket:', saveError);
      return res.status(500).json({ error: 'Failed to save bracket' });
    }

    // Format participants for response
    const participants = registrations.map(reg => {
      console.log(`Processing registration for ${reg.username}, team_type: ${event.team_type}`);
      
      if (event.team_type === 'solo') {
        return {
          id: reg.id.toString(),
          name: reg.username,
          userId: reg.user_id
        };
      } else {
        // For duo or team, include team members
        const teamMembers = reg.event_team_members || [];
        console.log(`Found ${teamMembers.length} team members for ${reg.username}:`, teamMembers);
        
        return {
          id: reg.id.toString(),
          name: reg.username, // Team captain/name
          userId: reg.user_id,
          members: teamMembers.map(member => ({
            id: member.id.toString(),
            name: member.username,
            userId: member.user_id
          }))
        };
      }
    });

    return res.status(201).json({
      bracket: bracketData,
      participants,
      eventType: event.team_type
    });
  } catch (error) {
    console.error('Error in generateBracket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update an existing bracket (for match results)
async function updateBracket(req, res, supabase, eventId, user) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!userData.is_admin) {
      return res.status(403).json({ error: 'Only admins can update brackets' });
    }

    const { matchId, winnerId } = req.body;
    
    if (!matchId || !winnerId) {
      return res.status(400).json({ error: 'Match ID and winner ID are required' });
    }

    // Get current bracket
    const { data: bracketData, error: bracketError } = await supabase
      .from('event_brackets')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (bracketError) {
      console.error('Error fetching bracket:', bracketError);
      return res.status(404).json({ error: 'Bracket not found' });
    }

    // First, retrieve all match details for this event to ensure they are preserved
    const { data: matchDetailsData, error: matchDetailsError } = await supabase
      .from('event_match_details')
      .select('*')
      .eq('event_id', eventId);

    if (matchDetailsError) {
      console.error('Error fetching match details:', matchDetailsError);
      // Continue anyway as this shouldn't block the main bracket update
    }

    // Create a map of match details for faster lookup
    const detailsMap = {};
    if (matchDetailsData && matchDetailsData.length > 0) {
      matchDetailsData.forEach(detail => {
        if (detail && detail.match_id) {
          detailsMap[detail.match_id] = {
            scheduled_time: detail.scheduled_time,
            location: detail.location,
            notes: detail.notes
          };
        }
      });
    }

    // Update the match with the winner
    const updatedMatches = updateMatchResult(bracketData.matches, matchId, winnerId);

    // Apply match details to the updated matches to ensure they're preserved
    for (let r = 0; r < updatedMatches.length; r++) {
      for (let m = 0; m < updatedMatches[r].length; m++) {
        const match = updatedMatches[r][m];
        const details = detailsMap[match.id];
        
        if (details) {
          // Preserve details in the bracket data
          updatedMatches[r][m] = {
            ...match,
            scheduledTime: details.scheduled_time || '',
            location: details.location || '',
            notes: details.notes || ''
          };
        }
      }
    }

    // Save updated bracket
    const { data: updatedBracket, error: updateError } = await supabase
      .from('event_brackets')
      .update({ 
        matches: updatedMatches,
        updated_at: new Date()
      })
      .eq('id', bracketData.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bracket:', updateError);
      return res.status(500).json({ error: 'Failed to update bracket' });
    }
    
    // Get participant data to return with the response
    const { data: registrations, error: participantsError } = await supabase
      .from('event_registrations')
      .select(`
        id, 
        user_id, 
        username,
        event_team_members (
          id,
          user_id,
          username
        )
      `)
      .eq('event_id', eventId)
      .in('status', ['confirmed', 'registered']);
    
    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      // We can continue even if the participant fetch fails
    }

    // Format participants for consistent format with getBracket
    const participants = registrations ? registrations.map(reg => ({
      id: reg.id.toString(),
      username: reg.username,
      userId: reg.user_id,
      members: (reg.event_team_members || []).map(member => ({
        id: member.id.toString(),
        username: member.username,
        userId: member.user_id
      }))
    })) : [];

    return res.status(200).json({ 
      success: true,
      bracket: updatedBracket.matches,
      participants: participants
    });
  } catch (error) {
    console.error('Error in updateBracket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete a bracket for an event
async function deleteBracket(req, res, supabase, eventId, user) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!userData.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete brackets' });
    }

    // Check if bracket exists
    const { data: bracketData, error: bracketError } = await supabase
      .from('event_brackets')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (bracketError && bracketError.code !== 'PGRST116') {
      console.error('Error checking bracket existence:', bracketError);
      return res.status(500).json({ error: 'Failed to check bracket existence' });
    }

    if (!bracketData) {
      return res.status(404).json({ error: 'Bracket not found for this event' });
    }

    // First, delete any associated match details for this event
    const { error: matchDetailsDeleteError } = await supabase
      .from('event_match_details')
      .delete()
      .eq('event_id', eventId);
    
    if (matchDetailsDeleteError) {
      console.error('Error deleting match details:', matchDetailsDeleteError);
      // Continue anyway since deleting the bracket is the primary goal
      console.log('Continuing with bracket deletion despite match details error');
    } else {
      console.log(`Successfully deleted all match details for event ${eventId}`);
    }

    // Delete the bracket
    const { error: deleteError } = await supabase
      .from('event_brackets')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting bracket:', deleteError);
      return res.status(500).json({ error: 'Failed to delete bracket' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Tournament bracket and all associated match details deleted successfully' 
    });
  } catch (error) {
    console.error('Error in deleteBracket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Helper function to generate tournament bracket
function generateTournamentBracket(participants, bracketSize) {
  // Get the actual number of participants
  const numParticipants = participants.length;
  
  // Use the larger of bracketSize or numParticipants to ensure we have enough slots
  const effectiveBracketSize = Math.max(bracketSize, numParticipants);
  
  // Calculate the number of rounds needed
  const numRounds = Math.ceil(Math.log2(effectiveBracketSize));
  
  // Calculate the perfect bracket size (power of 2)
  const perfectBracketSize = Math.pow(2, numRounds);
  
  // Calculate number of byes needed
  const numByes = perfectBracketSize - numParticipants;
  
  // Create an array to hold all rounds of matches
  const rounds = [];
  
  // Calculate total number of matches in the tournament
  const totalMatches = perfectBracketSize - 1;
  
  // Start with match ID 1 for the first round
  let matchId = 1;
  
  // Pre-calculate the starting match ID for each round
  const roundStartIds = [];
  let currentStartId = 1;
  for (let round = 1; round <= numRounds; round++) {
    roundStartIds.push(currentStartId);
    currentStartId += perfectBracketSize / Math.pow(2, round);
  }
  
  // Generate first round with participants and byes
  const firstRound = [];
  
  for (let i = 0; i < perfectBracketSize / 2; i++) {
    // Calculate the next match ID
    // For a proper tournament bracket, match IDs 1 and 2 feed into match ID (perfectBracketSize/2 + 1)
    // Match IDs 3 and 4 feed into match ID (perfectBracketSize/2 + 2), and so on
    const nextRoundStartId = roundStartIds[1]; // Starting ID of round 2
    const nextMatchId = nextRoundStartId + Math.floor(i / 2);
    
    // If we still have participants to add
    if (i * 2 < numParticipants) {
      const participant1 = participants[i * 2];
      
      // Check if we need a bye for the second participant
      if (i * 2 + 1 < numParticipants) {
        const participant2 = participants[i * 2 + 1];
        firstRound.push({
          id: matchId,
          round: 1,
          participant1Id: participant1.id.toString(),
          participant1Name: participant1.username,
          participant2Id: participant2.id.toString(),
          participant2Name: participant2.username,
          winnerId: null,
          nextMatchId: nextMatchId
        });
      } else {
        // Add a bye (participant automatically advances)
        firstRound.push({
          id: matchId,
          round: 1,
          participant1Id: participant1.id.toString(),
          participant1Name: participant1.username,
          participant2Id: null,
          participant2Name: 'Bye',
          winnerId: participant1.id.toString(), // Auto-advance
          nextMatchId: nextMatchId
        });
      }
    } else {
      // Add empty match for bracket balance
      firstRound.push({
        id: matchId,
        round: 1,
        participant1Id: null,
        participant1Name: 'TBD',
        participant2Id: null,
        participant2Name: 'TBD',
        winnerId: null,
        nextMatchId: nextMatchId
      });
    }
    matchId++;
  }
  
  rounds.push(firstRound);
  
  // Generate subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const roundMatches = [];
    const matchesInRound = perfectBracketSize / Math.pow(2, round);
    
    for (let i = 0; i < matchesInRound; i++) {
      // Calculate next match ID for this match
      let nextMatchId = null;
      
      if (round < numRounds) {
        const nextRoundStartId = roundStartIds[round]; // Starting ID of next round
        nextMatchId = nextRoundStartId + Math.floor(i / 2);
      }
      
      roundMatches.push({
        id: matchId,
        round: round,
        participant1Id: null,
        participant1Name: 'TBD',
        participant2Id: null,
        participant2Name: 'TBD',
        winnerId: null,
        nextMatchId: nextMatchId
      });
      
      matchId++;
    }
    
    rounds.push(roundMatches);
  }
  
  return rounds;
}

// Helper function to update match result and propagate winners
function updateMatchResult(rounds, matchId, winnerId) {
  // Create a deep copy of the rounds
  const updatedRounds = JSON.parse(JSON.stringify(rounds));
  
  // Find the match to update and its round index
  let matchToUpdate = null;
  let currentRoundIndex = -1;
  let matchIndex = -1;
  
  for (let i = 0; i < updatedRounds.length; i++) {
    matchIndex = updatedRounds[i].findIndex(m => m.id === parseInt(matchId));
    if (matchIndex !== -1) {
      matchToUpdate = updatedRounds[i][matchIndex];
      currentRoundIndex = i;
        break;
    }
  }
  
  if (!matchToUpdate) {
    throw new Error(`Match with ID ${matchId} not found`);
  }
  
  // Update the winner
  matchToUpdate.winnerId = winnerId;
  
  // Get winner name
  let winnerName = '';
  if (matchToUpdate.participant1Id === winnerId) {
    winnerName = matchToUpdate.participant1Name;
  } else if (matchToUpdate.participant2Id === winnerId) {
    winnerName = matchToUpdate.participant2Name;
  }
  
  console.log(`Setting winner of match ${matchId} to ${winnerName} (ID: ${winnerId})`);
  
  // If not the final round, propagate to the next match
  if (currentRoundIndex < updatedRounds.length - 1) {
    // Calculate next match index - this is key to determining the correct position
    const nextRoundMatchIndex = Math.floor(matchIndex / 2);
    
    // Get the next match
    if (updatedRounds[currentRoundIndex + 1] && 
        updatedRounds[currentRoundIndex + 1][nextRoundMatchIndex]) {
      
      const nextMatch = updatedRounds[currentRoundIndex + 1][nextRoundMatchIndex];
      
      // Determine the correct position based on the match index (not ID)
      // This ensures consistency even after swaps
      const isParticipant1Position = matchIndex % 2 === 0;
      const targetPosition = isParticipant1Position ? 'participant1Id' : 'participant2Id';
      const targetNamePosition = isParticipant1Position ? 'participant1Name' : 'participant2Name';
      
      // Check if this participant is already in the next match due to a previous swap
      const alreadyInNextMatch = 
        nextMatch.participant1Id === winnerId || 
        nextMatch.participant2Id === winnerId;
      
      console.log(`Advancing ${winnerName} to match ${nextMatch.id}, expected position: ${isParticipant1Position ? 'first' : 'second'}`);
      
      // If already in the match but in the wrong position, we need to handle the swap case
      if (alreadyInNextMatch) {
        const existingPosition = nextMatch.participant1Id === winnerId ? 'participant1Id' : 'participant2Id';
        const existingNamePosition = nextMatch.participant1Id === winnerId ? 'participant1Name' : 'participant2Name';
        
        // If it's already in the expected position, nothing to do
        if (existingPosition === targetPosition) {
          console.log(`${winnerName} is already in the correct position (${targetPosition}), no change needed`);
        } 
        // If it's in the opposite position, we have a swap scenario - don't change it
        else {
          console.log(`${winnerName} is already in position ${existingPosition} (swapped from expected ${targetPosition}), preserving swap`);
        }
      } 
      // Not already in the match, so place in the expected position
      // BUT, check if another match affects the other position before placing
      else {
        // Determine the opposite position
        const oppositePosition = isParticipant1Position ? 'participant2Id' : 'participant1Id';
        const oppositeNamePosition = isParticipant1Position ? 'participant2Name' : 'participant1Name';
        
        // Check if the target position is occupied by someone else
        if (nextMatch[targetPosition] !== null && nextMatch[targetPosition] !== winnerId) {
          // If there's already a different participant in this spot, this means
          // the other feeder match has set a winner, so don't change it
          console.log(`Position ${targetPosition} already occupied by ${nextMatch[targetNamePosition]}`);
          
          // If the opposing position is empty, we'll use that instead
          if (nextMatch[oppositePosition] === null) {
            console.log(`Using opposite position ${oppositePosition} for ${winnerName}`);
            nextMatch[oppositePosition] = winnerId;
            nextMatch[oppositeNamePosition] = winnerName;
          } 
          // Both positions are occupied but neither is our winner - this is odd
          else if (nextMatch[oppositePosition] !== winnerId) {
            console.log(`WARNING: Both positions occupied but ${winnerName} is not in either - bracket may be inconsistent`);
          }
        } 
        // Normal case - the target position is empty or is already us
        else {
          console.log(`Placing ${winnerName} in ${targetPosition}`);
          nextMatch[targetPosition] = winnerId;
          nextMatch[targetNamePosition] = winnerName;
        }
      }
      
      // Check if both participants are set and one is a bye
    if (nextMatch.participant1Id && nextMatch.participant2Id) {
      if (nextMatch.participant2Name === 'Bye') {
        // Participant 1 automatically advances
        nextMatch.winnerId = nextMatch.participant1Id;
        console.log(`Auto-advancing ${nextMatch.participant1Name} due to bye`);
        
          // Recursively update next matches
          updateMatchResult(updatedRounds, nextMatch.id, nextMatch.participant1Id);
      } else if (nextMatch.participant1Name === 'Bye') {
        // Participant 2 automatically advances
        nextMatch.winnerId = nextMatch.participant2Id;
        console.log(`Auto-advancing ${nextMatch.participant2Name} due to bye`);
        
          // Recursively update next matches
          updateMatchResult(updatedRounds, nextMatch.id, nextMatch.participant2Id);
        }
      }
    }
  }
  
  return updatedRounds;
} 