import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log("API endpoint called:", req.method, req.url);
  
  try {
    // Initialize Supabase with anon key - no auth for public endpoints
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // Get the event ID from the URL
    const { id } = req.query;
    console.log("Fetching event with ID:", id);
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // GET requests can be public
        return getEvent(req, res, supabase, id);
      case 'PUT':
      case 'DELETE':
        // PUT and DELETE requests require authentication
        return handleAuthenticatedRequest(req, res, supabase, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Function to handle authenticated requests
async function handleAuthenticatedRequest(req, res, supabase, id) {
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
  
  console.log("User authenticated:", !!user);
  
  if (authError || !user) {
    console.log("Authentication failed:", authError?.message);
    return res.status(401).json({
      error: 'not_authenticated',
      description: 'The user does not have an active session or is not authenticated',
    });
  }
  
  // Handle the authenticated request based on the method
  switch (req.method) {
    case 'PUT':
      return updateEvent(req, res, authenticatedSupabase, id, user);
    case 'DELETE':
      return deleteEvent(req, res, authenticatedSupabase, id, user);
    default:
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

// Get a single event by ID - no authentication required
async function getEvent(req, res, supabase, id) {
  try {
    console.log("Executing getEvent query for ID:", id);
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error("Database error:", error);
      throw error;
    }
    
    if (!data) {
      console.log("Event not found with ID:", id);
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Normalize team_type field to ensure consistent casing
    if (data.team_type) {
      console.log("Original team_type:", data.team_type);
      data.team_type = data.team_type.trim().toLowerCase();
      console.log("Normalized team_type:", data.team_type);
    } else {
      // Set default team_type if missing
      data.team_type = 'solo';
      console.log("Set default team_type to 'solo'");
    }
    
    // Get all registrations for this event to count properly
    console.log("Checking actual registration count for event:", id);
    
    // For duo events, we need to count teams not individual registrations
    if (data.team_type === 'duo') {
      // Method 1: Count only registrations that aren't partners
      const { data: registrations, error: regError } = await supabase
        .from('event_registrations')
        .select('id, notes, user_id')
        .eq('event_id', id);
      
      if (!regError && registrations) {
        // Count only main registrants (those without "Auto-registered as partner of" in notes)
        const mainRegistrants = registrations.filter(reg => 
          !reg.notes || !reg.notes.startsWith('Auto-registered as partner of')
        );
        
        console.log("Actual team count (main registrants):", mainRegistrants.length);
        console.log("Database count:", data.registered_count);
        
        // Update the response data with the actual count
        data.registered_count = mainRegistrants.length;
        
        // If the count in the database is wrong, update it
        if (data.registered_count !== mainRegistrants.length) {
          console.log("Updating database registration count to:", mainRegistrants.length);
          const { error: updateError } = await supabase
            .from('events')
            .update({ registered_count: mainRegistrants.length })
            .eq('id', id);
          
          if (updateError) {
            console.error("Error updating event registration count:", updateError);
          } else {
            console.log("Successfully updated event registration count in database");
          }
        }
      } else if (regError) {
        console.error("Error fetching registrations:", regError);
      }
    } else {
      // For solo events, count all registrations
      const { count: actualRegistrationCount, error: countError } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id);
      
      if (!countError && actualRegistrationCount !== null) {
        console.log("Actual registration count:", actualRegistrationCount, "Database count:", data.registered_count);
        
        // Update the response data with the actual count
        data.registered_count = actualRegistrationCount;
        
        // If the count in the database is wrong, update it
        if (data.registered_count !== actualRegistrationCount) {
          console.log("Updating database registration count to:", actualRegistrationCount);
          const { error: updateError } = await supabase
            .from('events')
            .update({ registered_count: actualRegistrationCount })
            .eq('id', id);
          
          if (updateError) {
            console.error("Error updating event registration count:", updateError);
          } else {
            console.log("Successfully updated event registration count in database");
          }
        }
      } else if (countError) {
        console.error("Error counting registrations:", countError);
      }
    }
    
    console.log("Event found:", data.id, data.title, "with", data.registered_count, "registrations");
    // Return the event data in the expected format
    return res.status(200).json({ event: data });
  } catch (error) {
    console.error("Error in getEvent:", error);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
}

// Update an existing event - requires authentication and admin privileges
async function updateEvent(req, res, supabase, id, user) {
  const updateData = req.body;
  
  console.log("Update event request body:", updateData);

  try {
    // Check if the user is an admin
    const { data: userRoleData, error: userRoleError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userRoleError || !userRoleData?.is_admin) {
      return res.status(403).json({ message: 'Only admins can update events' });
    }
    
    // First get the current event data
    const { data: currentEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError) {
      console.error("Error fetching current event data:", fetchError);
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Validate registration_limit if provided
    if (updateData.registration_limit !== undefined) {
      if (updateData.registration_limit === null || updateData.registration_limit === '') {
        // Allow setting to null/empty to remove the limit
        updateData.registration_limit = null;
      } else {
        const parsedLimit = parseInt(updateData.registration_limit);
        if (isNaN(parsedLimit) || parsedLimit <= 0) {
          return res.status(400).json({ error: 'Registration limit must be a positive number' });
        }
        updateData.registration_limit = parsedLimit;
      }
    }
    
    // Validate team_type if provided
    if (updateData.team_type !== undefined) {
      const validTeamTypes = ['solo', 'duo', 'team'];
      if (!validTeamTypes.includes(updateData.team_type)) {
        return res.status(400).json({ error: 'Invalid team type value. Must be one of: solo, duo, team' });
      }
      
      // If changing from non-solo to solo, check if there are team members
      if (currentEvent.team_type !== 'solo' && updateData.team_type === 'solo') {
        // First, get all registration IDs for this event
        const { data: registrations, error: regError } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', id);
          
        if (regError) {
          console.error("Error fetching registrations:", regError);
          return res.status(500).json({ error: 'Failed to check existing registrations' });
        }
        
        // Extract registration IDs into an array
        const registrationIds = registrations.map(reg => reg.id);
        
        // Only proceed with the check if there are registrations
        if (registrationIds.length > 0) {
          // Check if there are any team members for these registrations
          const { count, error: countError } = await supabase
            .from('event_team_members')
            .select('id', { count: 'exact', head: true })
            .in('registration_id', registrationIds);
            
          if (!countError && count > 0) {
            return res.status(400).json({ 
              error: 'Cannot change to solo event. There are existing team members for this event.' 
            });
          }
        }
      }
    }
    
    // Prepare update object with only the fields that are provided
    const updateObject = {
      ...updateData,
      updated_at: new Date().toISOString()
    };
    
    // Set default status if not provided
    if (updateObject.status === undefined && currentEvent.status) {
      updateObject.status = currentEvent.status;
    } else if (updateObject.status === undefined) {
      updateObject.status = 'Upcoming';
    }
    
    console.log("Updating event with data:", updateObject);

    // Update the event
    const { data, error } = await supabase
      .from('events')
      .update(updateObject)
      .eq('id', id)
      .select();

    if (error) {
      console.error("Error updating event in database:", error);
      throw error;
    }

    console.log("Event updated successfully:", data[0].id);
    return res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ message: 'Error updating event', error: error.message });
  }
}

// Delete an event
async function deleteEvent(req, res, supabase, id, user) {
  try {
    // Check if the user is an admin
    const { data: userRoleData, error: userRoleError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userRoleError || !userRoleData?.is_admin) {
      return res.status(403).json({ message: 'Only admins can delete events' });
    }

    // Delete the event
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
} 