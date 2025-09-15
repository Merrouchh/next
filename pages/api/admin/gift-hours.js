import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify admin access
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (userError || !userData || !userData.is_admin) {
    throw new Error('Admin access required');
  }

  return user;
}

export default async function handler(req, res) {
  try {
    console.log('Gift hours API called:', { method: req.method, url: req.url, body: req.body });
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    await verifyAdmin(req.headers.authorization);
    console.log('Admin verification passed');
    
    const { userId, hours } = req.body;

    if (!userId || !hours) {
      return res.status(400).json({
        success: false,
        error: 'User ID and hours are required'
      });
    }

    const hoursToAdd = parseFloat(hours);
    if (isNaN(hoursToAdd) || hoursToAdd <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Hours must be a positive number'
      });
    }

    console.log(`Gifting ${hoursToAdd} hours to user ${userId}`);

    // Get user details first
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, email, gizmo_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.log('User not found:', userError);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('User found:', userData);

    if (!userData.gizmo_id) {
      return res.status(400).json({
        success: false,
        error: 'User does not have a Gizmo account linked'
      });
    }

    // Convert hours to seconds (1 hour = 3600 seconds)
    const secondsToAdd = Math.floor(hoursToAdd * 3600);

    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error('Missing API configuration');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // IMPORTANT: The Gizmo API treats seconds as MINUTES, so convert
    const apiAmount = Math.round(secondsToAdd / 60);
    
    console.log(`Gifting ${hoursToAdd} hours (${secondsToAdd} seconds) to Gizmo ID ${userData.gizmo_id}`);
    console.log(`API amount: ${apiAmount} minutes`);

    // Create base64 encoded auth header for the Gizmo API
    const gizmoAuthHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    // Call the Gizmo API to add time directly to the user's account
    const fullUrl = `${apiUrl}/users/${userData.gizmo_id}/order/time/${apiAmount}/price/0/invoice`;
    console.log(`Calling Gizmo API: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': gizmoAuthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    // Get response as text first
    const responseText = await response.text();
    console.log(`Gizmo API response status: ${response.status}`);
    console.log(`Gizmo API response: ${responseText}`);

    if (!response.ok) {
      console.error('Gizmo API error:', responseText);
      return res.status(500).json({
        success: false,
        error: 'Failed to add time to Gizmo account',
        details: responseText
      });
    }

    // Try to parse JSON response
    let gizmoResponse;
    try {
      gizmoResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.warn('Could not parse Gizmo API response as JSON:', parseError);
      gizmoResponse = { message: responseText };
    }

    console.log(`Successfully gifted ${hoursToAdd} hours (${apiAmount} minutes) to Gizmo ID ${userData.gizmo_id}`);

    return res.status(200).json({
      success: true,
      message: `Successfully gifted ${hoursToAdd} hours to ${userData.username}`,
      data: {
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        gizmo_id: userData.gizmo_id,
        hoursGifted: hoursToAdd,
        secondsAdded: secondsToAdd,
        apiMinutes: apiAmount,
        gizmoResponse: gizmoResponse
      }
    });

  } catch (error) {
    console.error('Gift hours error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
