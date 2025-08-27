import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  console.log("API events endpoint called:", req.method);
  
  try {
    // Check for required environment variables
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL is required');
    }
    if (!process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_ANON_KEY is required');
    }
    
    // Initialize Supabase with anon key
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        // GET requests can be public
        return getEvents(req, res, supabase);
      case 'POST':
        // POST requests require authentication
        return handleAuthenticatedRequest(req, res, supabase, createEvent);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Function to handle authenticated requests
async function handleAuthenticatedRequest(req, res, supabase, handlerFunction) {
  // Create authenticated client with token from request
  const authenticatedSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
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
  
  // Call the handler function with the authenticated client
  return handlerFunction(req, res, authenticatedSupabase, user);
}

// Get all events - no authentication required
async function getEvents(req, res, supabase) {
  try {
    // First get all events
    const { data, error } = await supabase
      .from('events')
      .select('*');
    
    if (error) throw error;
    
    // Sort events by status and date
    // Order: Upcoming, In Progress, Completed
    const sortedEvents = data.sort((a, b) => {
      // First sort by status
      const statusOrder = { 'Upcoming': 0, 'In Progress': 1, 'Completed': 2 };
      const statusA = statusOrder[a.status || 'Upcoming'];
      const statusB = statusOrder[b.status || 'Upcoming'];
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Then sort by date (descending - newest first)
      return new Date(b.date) - new Date(a.date);
    });
    
    return res.status(200).json(sortedEvents || []);
  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

// Create a new event - requires authentication
async function createEvent(req, res, supabase, user) {
  try {
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({ error: 'Only admins can create events' });
    }
    
    const { title, description, date, time, location, game, status, image, registration_limit, team_type } = req.body;
    
    // Validate required fields
    if (!title || !description || !date || !time || !location || !game) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate status if provided
    const validStatuses = ['Upcoming', 'In Progress', 'Completed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value. Must be one of: Upcoming, In Progress, Completed' });
    }
    
    // Validate team_type if provided
    const validTeamTypes = ['solo', 'duo', 'team'];
    if (team_type && !validTeamTypes.includes(team_type)) {
      return res.status(400).json({ error: 'Invalid team type value. Must be one of: solo, duo, team' });
    }
    
    // Validate registration_limit if provided
    let parsedLimit = null;
    if (registration_limit) {
      parsedLimit = parseInt(registration_limit);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({ error: 'Registration limit must be a positive number' });
      }
    }
    
    // Insert event into database
    const { data, error } = await supabase
      .from('events')
      .insert([
        { 
          title, 
          description, 
          date, 
          time, 
          location,
          game,
          status: status || 'Upcoming', // Default to 'Upcoming' if not provided
          image,
          registration_limit: parsedLimit,
          team_type: team_type || 'solo', // Default to 'solo' if not provided
          phone_verification_required: req.body.phone_verification_required !== false, // Default to true if not provided
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
} 