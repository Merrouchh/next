import createClient from '../../../utils/supabase/api';

export default async function handler(req, res) {
  console.log("API events endpoint called:", req.method);
  
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
    
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return getEvents(req, res, supabase);
      case 'POST':
        return createEvent(req, res, supabase);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error("API handler error:", error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Get all events
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
      
      // Then sort by date (ascending)
      return new Date(a.date) - new Date(b.date);
    });
    
    return res.status(200).json(sortedEvents || []);
  } catch (error) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

// Create a new event
async function createEvent(req, res, supabase) {
  try {
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