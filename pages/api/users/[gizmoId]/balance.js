export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gizmoId } = req.query;

    if (!gizmoId) {
      return res.status(400).json({ error: 'Gizmo ID is required' });
    }

    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      throw new Error('Missing API configuration');
    }

    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    const fullUrl = `${apiUrl}/users/${gizmoId}/balance`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch balance from Gizmo API');
    }

    const data = await response.json();
    
    return res.status(200).json({ 
      result: {
        balance: data.result?.balance || 0
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      result: {
        balance: 0
      }
    });
  }
} 