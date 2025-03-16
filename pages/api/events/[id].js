import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  console.log("API endpoint called:", req.method, req.url);
  
  try {
    // Create authenticated Supabase client
    const supabase = createClient(req, res);
    
    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    console.log("Session exists:", !!session);
    
    if (!session) {
      console.log("Authentication failed: No session");
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      });
    }
    
    // Get the event ID from the URL
    const { id } = req.query;
    console.log("Fetching event with ID:", id);
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return getEvent(req, res, supabase, id);
      case 'PUT':
        return updateEvent(req, res, supabase, id);
      case 'DELETE':
        return deleteEvent(req, res, supabase, id);
      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Get a single event by ID
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
    
    // Get the actual count of registrations
    console.log("Checking actual registration count for event:", id);
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
    
    console.log("Event found:", data.id, data.title, "with", data.registered_count, "registrations");
    // Return the event data in the expected format
    return res.status(200).json({ event: data });
  } catch (error) {
    console.error("Error in getEvent:", error);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
}

// Update an existing event
async function updateEvent(req, res, supabase, id) {
  const updateData = req.body;
  
  console.log("Update event request body:", updateData);

  try {
    // Check if the user is an admin
    const { data: userData } = await supabase.auth.getUser();
    const { data: userRoleData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single();

    if (!userRoleData?.is_admin) {
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
async function deleteEvent(req, res, supabase, id) {
  try {
    // Check if the user is an admin
    const { data: userData } = await supabase.auth.getUser();
    const { data: userRoleData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userData.user.id)
      .single();

    if (!userRoleData?.is_admin) {
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