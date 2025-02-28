export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gizmoId } = req.query;
    console.log('Fetching time info for gizmoId:', gizmoId);

    if (!gizmoId) {
      return res.status(400).json({ error: 'Gizmo ID is required' });
    }

    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error('Missing API configuration');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create base64 encoded auth header
    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    const fullUrl = `${apiUrl}/users/${gizmoId}/producttimeextended`;
    console.log('Making request to:', fullUrl);

    // Make request to Gizmo API
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gizmo API error:', errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch time info from Gizmo API',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('Raw API response:', data);

    // Ensure data has the expected structure
    if (!data || !Array.isArray(data.result)) {
      console.error('Invalid data structure received:', data);
      return res.status(200).json({ 
        result: [] 
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Error in producttimeextended API route:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      result: [] // Include empty result for consistent structure
    });
  }
} 