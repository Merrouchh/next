export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gizmoId } = req.query;

  if (!gizmoId) {
    return res.status(400).json({ error: 'Gizmo ID is required' });
  }

  try {
    console.log('Fetching points for Gizmo ID:', gizmoId);
    
    // Create Basic Auth header from environment variables
    const auth = process.env.API_AUTH;
    if (!auth) {
      throw new Error('API_AUTH environment variable is not set');
    }
    
    const authHeader = 'Basic ' + Buffer.from(auth).toString('base64');
    const apiUrl = process.env.API_BASE_URL;
    
    // Call Gizmo API to get user points
    const pointsResponse = await fetch(`${apiUrl}/users/${gizmoId}/points`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    console.log('Points API Response Status:', pointsResponse.status);
    const pointsData = await pointsResponse.json();
    console.log('Points API Response:', pointsData);

    if (!pointsResponse.ok) {
      return res.status(pointsResponse.status).json({ 
        error: 'Gizmo API error',
        details: pointsData
      });
    }

    return res.status(200).json(pointsData);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}
