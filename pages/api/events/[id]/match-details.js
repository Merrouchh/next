import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Initialize Supabase with anon key
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
        return await getMatchDetails(req, res, supabase, eventId);
      case 'POST':
      case 'PUT':
      case 'DELETE': // Add DELETE method for resetting match times
        return await handleAuthenticatedRequest(req, res, supabase, eventId);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unhandled error in match-details API:', error);
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
  
  // Check if user is admin
  const { data: userData, error: userError } = await authenticatedSupabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  
  if (userError || !userData || !userData.is_admin) {
    return res.status(403).json({ error: 'Only admins can update match details' });
  }
  
  // Handle the authenticated request based on the method
  switch (req.method) {
    case 'POST':
      return await createMatchDetails(req, res, authenticatedSupabase, eventId);
    case 'PUT':
      return await updateMatchDetails(req, res, authenticatedSupabase, eventId);
    case 'DELETE':
      // If a specific action is requested in the query params, route accordingly
      if (req.query.action === 'resetTimes') {
        return await resetMatchTimes(req, res, authenticatedSupabase, eventId);
      } else {
        return await deleteMatchDetails(req, res, authenticatedSupabase, eventId);
      }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Get match details for an event
async function getMatchDetails(req, res, supabase, eventId) {
  try {
    // First check if the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get match details
    const { data: details, error: detailsError } = await supabase
      .from('event_match_details')
      .select('*')
      .eq('event_id', eventId);
    
    if (detailsError) {
      console.error('Error fetching match details:', detailsError);
      return res.status(500).json({ error: 'Failed to fetch match details' });
    }
    
    return res.status(200).json({ details: details || [] });
  } catch (error) {
    console.error('Error in getMatchDetails:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Create match details
async function createMatchDetails(req, res, supabase, eventId) {
  try {
    const { matchId, scheduledTime, location, notes } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ error: 'Match ID is required' });
    }
    
    // Check if details already exist for this match
    const { data: existingDetails, error: checkError } = await supabase
      .from('event_match_details')
      .select('id')
      .eq('event_id', eventId)
      .eq('match_id', matchId)
      .single();
    
    if (existingDetails) {
      return res.status(409).json({ error: 'Match details already exist for this match' });
    }
    
    // Create new match details
    const { data: newDetails, error: createError } = await supabase
      .from('event_match_details')
      .insert([
        {
          event_id: eventId,
          match_id: matchId,
          scheduled_time: scheduledTime || null,
          location: location || null,
          notes: notes || null
        }
      ])
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating match details:', createError);
      return res.status(500).json({ error: 'Failed to create match details' });
    }
    
    return res.status(201).json({ 
      success: true,
      details: newDetails
    });
  } catch (error) {
    console.error('Error in createMatchDetails:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update match details
async function updateMatchDetails(req, res, supabase, eventId) {
  try {
    const { matchId, scheduledTime, location, notes } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ error: 'Match ID is required' });
    }
    
    // Check if details exist for this match
    const { data: existingDetails, error: checkError } = await supabase
      .from('event_match_details')
      .select('id')
      .eq('event_id', eventId)
      .eq('match_id', matchId)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking match details:', checkError);
      return res.status(500).json({ error: 'Failed to check match details' });
    }
    
    let result;
    
    if (existingDetails) {
      // Update existing details
      result = await supabase
        .from('event_match_details')
        .update({
          scheduled_time: scheduledTime || null,
          location: location || null,
          notes: notes || null,
          updated_at: new Date()
        })
        .eq('id', existingDetails.id)
        .select()
        .single();
    } else {
      // Create new details
      result = await supabase
        .from('event_match_details')
        .insert([
          {
            event_id: eventId,
            match_id: matchId,
            scheduled_time: scheduledTime || null,
            location: location || null,
            notes: notes || null
          }
        ])
        .select()
        .single();
    }
    
    if (result.error) {
      console.error('Error updating match details:', result.error);
      return res.status(500).json({ error: 'Failed to update match details' });
    }
    
    return res.status(200).json({ 
      success: true,
      details: result.data
    });
  } catch (error) {
    console.error('Error in updateMatchDetails:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Reset match times for an event
async function resetMatchTimes(req, res, supabase, eventId) {
  try {
    // First check if the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Update all match details for this event to reset scheduled_time
    const { data, error } = await supabase
      .from('event_match_details')
      .update({
        scheduled_time: null,
        updated_at: new Date()
      })
      .eq('event_id', eventId);
    
    if (error) {
      console.error('Error resetting match times:', error);
      return res.status(500).json({ error: 'Failed to reset match times' });
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'All match times for this event have been reset' 
    });
  } catch (error) {
    console.error('Error in resetMatchTimes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete all match details for an event
async function deleteMatchDetails(req, res, supabase, eventId) {
  try {
    // First check if the event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .single();
    
    if (eventError) {
      console.error('Error fetching event:', eventError);
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Delete all match details for this event
    const { error } = await supabase
      .from('event_match_details')
      .delete()
      .eq('event_id', eventId);
    
    if (error) {
      console.error('Error deleting match details:', error);
      return res.status(500).json({ error: 'Failed to delete match details' });
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'All match details for this event have been deleted' 
    });
  } catch (error) {
    console.error('Error in deleteMatchDetails:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 