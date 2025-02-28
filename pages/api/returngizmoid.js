import createClient from '../../utils/supabase/api'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    console.log('Starting Gizmo ID fetch for username:', username);
    
    const apiUrl = process.env.API_BASE_URL;
    const auth = process.env.API_AUTH;

    if (!apiUrl || !auth) {
      throw new Error('Missing API configuration');
    }

    const authHeader = `Basic ${Buffer.from(auth).toString('base64')}`;

    // Make the external API call
    const response = await fetch(`${apiUrl}/users/${username}/userid`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Check the actual response structure
    if (data.result) {
      // Return the Gizmo ID from the result field
      return res.status(200).json({ gizmoId: data.result });
    }

    console.error('No Gizmo ID found in response for username:', username);
    return res.status(200).json({ 
      gizmoId: null,
      message: `No Gizmo ID found for username: ${username}`
    });

  } catch (error) {
    console.error('Error fetching Gizmo ID:', error);
    return res.status(200).json({ 
      gizmoId: null,
      error: error.message 
    });
  }
}
