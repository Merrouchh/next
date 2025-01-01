import { supabase } from '../../contexts/AuthContext';

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
    
    // Create Basic Auth header from environment variables
    const auth = process.env.API_AUTH;
    if (!auth) {
      throw new Error('API_AUTH environment variable is not set');
    }
    
    const authHeader = 'Basic ' + Buffer.from(auth).toString('base64');
    const apiUrl = process.env.API_BASE_URL;
    
    // Use the correct endpoint format
    const gizmoResponse = await fetch(`${apiUrl}/users/${username}/userid`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    console.log('Gizmo API Response Status:', gizmoResponse.status);
    const gizmoData = await gizmoResponse.json();
    console.log('Gizmo API Response:', gizmoData);

    if (!gizmoResponse.ok) {
      return res.status(gizmoResponse.status).json({ 
        error: 'Gizmo API error',
        details: gizmoData
      });
    }

    // Check if we got a valid user ID
    if (!gizmoData.result) {
      return res.status(404).json({ 
        error: 'User not found in Gizmo',
        details: 'No user ID in response'
      });
    }

    const gizmoId = gizmoData.result; // The ID is directly in result
    console.log('Found Gizmo ID:', gizmoId);

    // Update Supabase with the Gizmo ID
    const { error: updateError } = await supabase
      .from('users')
      .update({ gizmo_id: gizmoId })
      .eq('username', username.toLowerCase());

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update user in database',
        details: updateError.message
      });
    }

    return res.status(200).json({ 
      gizmo_id: gizmoId,
      message: 'Gizmo ID successfully stored'
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}
