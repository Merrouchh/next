import { createClient } from '../../../../utils/supabase/server-props';

export default async function handler(req, res) {
  try {
    // Create authenticated Supabase client
    const supabase = createClient({ req, res });

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getBracket(req, res, supabase, eventId, session);
      case 'POST':
        return await generateBracket(req, res, supabase, eventId, session);
      case 'PUT':
        return await updateBracket(req, res, supabase, eventId, session);
      case 'DELETE':
        return await deleteBracket(req, res, supabase, eventId, session);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unhandled error in bracket API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get existing bracket for an event
async function getBracket(req, res, supabase, eventId, session) {
  try {
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

    // Format participants based on team type
    const participants = registrations.map(reg => {
      if (event.team_type === 'solo') {
        return {
          id: reg.id.toString(),
          name: reg.username,
          userId: reg.user_id
        };
      } else {
        // For duo or team, include team members
        const teamMembers = reg.event_team_members || [];
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

// Generate a new bracket for an event
async function generateBracket(req, res, supabase, eventId, session) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!userData.is_admin) {
      return res.status(403).json({ error: 'Only admins can generate brackets' });
    }

    // Check if event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if bracket already exists
    const { data: existingBracket, error: bracketError } = await supabase
      .from('event_brackets')
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingBracket) {
      return res.status(409).json({ error: 'Bracket already exists for this event' });
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

    if (!registrations || registrations.length === 0) {
      return res.status(400).json({ error: 'No participants registered for this event' });
    }

    // Shuffle participants for random seeding
    const shuffledParticipants = shuffleArray([...registrations]);
    
    // Generate bracket structure based on registration_limit or actual participants
    const bracketSize = event.registration_limit || registrations.length;
    const bracketData = generateTournamentBracket(shuffledParticipants, bracketSize);

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
      if (event.team_type === 'solo') {
        return {
          id: reg.id.toString(),
          name: reg.username,
          userId: reg.user_id
        };
      } else {
        // For duo or team, include team members
        const teamMembers = reg.event_team_members || [];
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
async function updateBracket(req, res, supabase, eventId, session) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
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

    // Update the match with the winner
    const updatedMatches = updateMatchResult(bracketData.matches, matchId, winnerId);

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

    return res.status(200).json({ 
      success: true,
      bracket: updatedBracket.matches
    });
  } catch (error) {
    console.error('Error in updateBracket:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete a bracket for an event
async function deleteBracket(req, res, supabase, eventId, session) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
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
      message: 'Tournament bracket deleted successfully' 
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
  
  // Find the match to update
  let matchToUpdate = null;
  
  for (let i = 0; i < updatedRounds.length; i++) {
    for (let j = 0; j < updatedRounds[i].length; j++) {
      if (updatedRounds[i][j].id === parseInt(matchId)) {
        matchToUpdate = updatedRounds[i][j];
        break;
      }
    }
    if (matchToUpdate) break;
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
  
  // If there's a next match, update the participant in that match
  if (matchToUpdate.nextMatchId) {
    const nextMatchId = matchToUpdate.nextMatchId;
    console.log(`Looking for next match with ID ${nextMatchId}`);
    
    // Find the next match
    let nextMatch = null;
    
    for (let i = 0; i < updatedRounds.length; i++) {
      for (let j = 0; j < updatedRounds[i].length; j++) {
        if (updatedRounds[i][j].id === nextMatchId) {
          nextMatch = updatedRounds[i][j];
          break;
        }
      }
      if (nextMatch) break;
    }
    
    if (!nextMatch) {
      console.error(`Next match with ID ${nextMatchId} not found`);
      return updatedRounds;
    }
    
    // Determine if this winner should go to participant1 or participant2 slot
    // This is based on the match ID being odd or even
    // Odd-numbered matches feed into participant1 slot of the next match
    // Even-numbered matches feed into participant2 slot of the next match
    const isOddMatch = matchToUpdate.id % 2 !== 0;
    
    if (isOddMatch) {
      nextMatch.participant1Id = winnerId;
      nextMatch.participant1Name = winnerName;
      console.log(`${winnerName} placed in participant1 slot of match ${nextMatchId}`);
    } else {
      nextMatch.participant2Id = winnerId;
      nextMatch.participant2Name = winnerName;
      console.log(`${winnerName} placed in participant2 slot of match ${nextMatchId}`);
    }
    
    // Check if both participants are set in the next match and one is a bye
    if (nextMatch.participant1Id && nextMatch.participant2Id) {
      if (nextMatch.participant2Name === 'Bye') {
        // Participant 1 automatically advances
        nextMatch.winnerId = nextMatch.participant1Id;
        console.log(`Auto-advancing ${nextMatch.participant1Name} due to bye`);
        
        // Recursively update the next matches
        if (nextMatch.nextMatchId) {
          console.log(`Recursively updating next matches from ${nextMatchId}`);
          updateMatchResult(updatedRounds, nextMatchId, nextMatch.participant1Id);
        }
      } else if (nextMatch.participant1Name === 'Bye') {
        // Participant 2 automatically advances
        nextMatch.winnerId = nextMatch.participant2Id;
        console.log(`Auto-advancing ${nextMatch.participant2Name} due to bye`);
        
        // Recursively update the next matches
        if (nextMatch.nextMatchId) {
          console.log(`Recursively updating next matches from ${nextMatchId}`);
          updateMatchResult(updatedRounds, nextMatchId, nextMatch.participant2Id);
        }
      }
    }
  }
  
  return updatedRounds;
} 