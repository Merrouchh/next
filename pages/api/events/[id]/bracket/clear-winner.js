import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Only allow PUT requests
    if (req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;
    const eventId = parseInt(id);
    const { matchId } = req.body;

    if (isNaN(eventId) || !matchId) {
      return res.status(400).json({ error: 'Invalid event ID or match ID' });
    }

    // Create authenticated client with token from request
    const supabase = createClient(
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

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

    // Get current bracket data
    const { data: bracketData, error: bracketError } = await supabase
      .from('event_brackets')
      .select('matches, id')
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

    // Parse matchId as integer
    const matchIdInt = parseInt(matchId);
    
    // Find the match and its round index
    let targetMatch = null;
    let currentRoundIndex = -1;
    let matchIndex = -1;
    
    // Search for the match in all rounds
    for (let r = 0; r < bracketData.matches.length; r++) {
      matchIndex = bracketData.matches[r].findIndex(m => m.id === matchIdInt);
      if (matchIndex !== -1) {
        targetMatch = bracketData.matches[r][matchIndex];
        currentRoundIndex = r;
        break;
      }
    }
    
    if (!targetMatch) {
      return res.status(404).json({ error: 'Match not found in bracket' });
    }
    
    // If match has no winner, nothing to do
    if (!targetMatch.winnerId) {
      return res.status(400).json({ error: 'Match does not have a winner to clear' });
    }
    
    // Track the winner ID we're removing
    const removedWinnerId = targetMatch.winnerId;
    
    // Deep copy the matches array to avoid mutation issues
    const updatedMatches = JSON.parse(JSON.stringify(bracketData.matches));
    
    // Clear the winner from the current match
    updatedMatches[currentRoundIndex][matchIndex].winnerId = null;
    
    // If not the final round, clear any advances to the next round
    if (currentRoundIndex < updatedMatches.length - 1) {
      // Calculate next match index
      const nextRoundMatchIndex = Math.floor(matchIndex / 2);
      
      // Determine participant position (odd matches go to participant1, even to participant2)
      const isParticipant1 = matchIndex % 2 === 0;
      const participantPosition = isParticipant1 ? 'participant1Id' : 'participant2Id';
      const namePosition = isParticipant1 ? 'participant1Name' : 'participant2Name';
      
      // Get the next match
      if (updatedMatches[currentRoundIndex + 1] && 
          updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex]) {
        
        const nextMatch = updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex];
        
        // We need to check both positions in the next match to handle swaps
        let foundInPosition = null;
        if (nextMatch.participant1Id === removedWinnerId) {
          foundInPosition = 'participant1Id';
        } else if (nextMatch.participant2Id === removedWinnerId) {
          foundInPosition = 'participant2Id';
        }
        
        // If this participant is in the next match (might be in swapped position), remove it
        if (foundInPosition) {
          const namePositionForFound = foundInPosition === 'participant1Id' ? 'participant1Name' : 'participant2Name';
          
          // Clear the participant from next match
          updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex][foundInPosition] = null;
          updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex][namePositionForFound] = 'TBD';
          
          // If that next match had this as the winner, recursively clear it
          if (nextMatch.winnerId === removedWinnerId) {
            // Use a recursive function to clear all subsequent advances
            clearAdvancingWinners(
              updatedMatches, 
              currentRoundIndex + 1, 
              nextRoundMatchIndex, 
              removedWinnerId
            );
          }
        }
      }
    }
    
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
    
    // Update the bracket in the database
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
    
    // Get the participants for this event to return along with the bracket
    // Use the same approach as in the bracket.js API to be consistent
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
      // Continue even if participants fetch fails - don't return an error
      return res.status(200).json({ 
        success: true,
        message: 'Winner cleared successfully',
        bracket: updatedMatches,
        participants: [] // Return empty array if participants fetch failed
      });
    }

    // Format participants for consistent format with bracket.js
    const participants = registrations.map(reg => ({
      id: reg.id.toString(),
      username: reg.username,
      userId: reg.user_id,
      members: (reg.event_team_members || []).map(member => ({
        id: member.id.toString(),
        username: member.username,
        userId: member.user_id
      }))
    }));
    
    // Disable caching of the response
      // Cache headers removed
    
    return res.status(200).json({ 
      success: true,
      message: 'Winner cleared successfully',
      bracket: updatedMatches,
      participants: participants
    });
  } catch (error) {
    console.error('Error in clear-winner API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper function to recursively clear advancing winners
function clearAdvancingWinners(matches, roundIndex, matchIndex, winnerId) {
  // Ensure we're not at the final round
  if (roundIndex >= matches.length - 1) return;
  
  // Get the current match
  const match = matches[roundIndex][matchIndex];
  
  // Clear the winner from this match
  matches[roundIndex][matchIndex].winnerId = null;
  
  // Calculate the next match index
  const nextRoundMatchIndex = Math.floor(matchIndex / 2);
  
  // Look for the participant in any position in the next match
  if (matches[roundIndex + 1] && matches[roundIndex + 1][nextRoundMatchIndex]) {
    const nextMatch = matches[roundIndex + 1][nextRoundMatchIndex];
    
    // Check both sides for the winner that needs to be removed
    if (nextMatch.participant1Id === winnerId) {
      // Clear from position 1
      matches[roundIndex + 1][nextRoundMatchIndex].participant1Id = null;
      matches[roundIndex + 1][nextRoundMatchIndex].participant1Name = 'TBD';
      
      // Continue recursion if this participant won the next match
      if (nextMatch.winnerId === winnerId) {
        clearAdvancingWinners(matches, roundIndex + 1, nextRoundMatchIndex, winnerId);
      }
    } 
    else if (nextMatch.participant2Id === winnerId) {
      // Clear from position 2
      matches[roundIndex + 1][nextRoundMatchIndex].participant2Id = null;
      matches[roundIndex + 1][nextRoundMatchIndex].participant2Name = 'TBD';
      
      // Continue recursion if this participant won the next match
      if (nextMatch.winnerId === winnerId) {
        clearAdvancingWinners(matches, roundIndex + 1, nextRoundMatchIndex, winnerId);
      }
    }
  }
} 