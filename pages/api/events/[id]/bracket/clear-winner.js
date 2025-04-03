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
        
        // Only clear if this participant advanced (matches our removedWinnerId)
        if (nextMatch[participantPosition] === removedWinnerId) {
          // Clear the participant from next match
          updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex][participantPosition] = null;
          updatedMatches[currentRoundIndex + 1][nextRoundMatchIndex][namePosition] = 'TBD';
          
          // If that next match had this as the winner, recursively clear
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
    
    // Disable caching of the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).json({ 
      success: true,
      message: 'Winner cleared successfully',
      bracket: updatedBracket.matches
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
  
  // Determine position in next match
  const isParticipant1 = matchIndex % 2 === 0;
  const participantPosition = isParticipant1 ? 'participant1Id' : 'participant2Id';
  const namePosition = isParticipant1 ? 'participant1Name' : 'participant2Name';
  
  // Process next match if it exists
  if (matches[roundIndex + 1] && matches[roundIndex + 1][nextRoundMatchIndex]) {
    const nextMatch = matches[roundIndex + 1][nextRoundMatchIndex];
    
    // Only proceed if this participant advanced
    if (nextMatch[participantPosition] === winnerId) {
      // Clear the participant
      matches[roundIndex + 1][nextRoundMatchIndex][participantPosition] = null;
      matches[roundIndex + 1][nextRoundMatchIndex][namePosition] = 'TBD';
      
      // If next match had this as winner, continue recursion
      if (nextMatch.winnerId === winnerId) {
        clearAdvancingWinners(matches, roundIndex + 1, nextRoundMatchIndex, winnerId);
      }
    }
  }
} 