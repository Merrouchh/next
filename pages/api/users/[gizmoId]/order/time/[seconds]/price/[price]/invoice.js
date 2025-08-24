import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get parameters from URL path
  const { gizmoId, seconds, price } = req.query;
  
  // Log request details including headers
  const requestId = req.headers['x-request-id'] || 'unknown';
  console.log(`[AMOUNT DEBUG] Server received request ${requestId}:`);
  console.log(`[AMOUNT DEBUG] - Path params: gizmoId=${gizmoId}, seconds=${seconds}, price=${price}`);
  console.log(`[AMOUNT DEBUG] - Headers: ${JSON.stringify(req.headers)}`);
  
  if (!gizmoId || !seconds || price === undefined) {
    console.log(`[AMOUNT DEBUG] Request ${requestId} missing parameters`);
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Authenticate request with Supabase (require a valid bearer token)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: missing bearer token' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Unauthorized: invalid session' });
    }

    // Convert to integers
    const secondsInt = parseInt(seconds, 10);
    const userIdInt = parseInt(gizmoId, 10);
    const priceInt = parseInt(price, 10);
    
    console.log(`[AMOUNT DEBUG] Request ${requestId} - Parsed values: secondsInt=${secondsInt}, userIdInt=${userIdInt}, priceInt=${priceInt}`);

    // Basic parameter validation and abuse protection
    if (!Number.isFinite(secondsInt) || secondsInt <= 0) {
      return res.status(400).json({ error: 'Invalid seconds value' });
    }
    if (!Number.isFinite(priceInt) || priceInt !== 0) {
      return res.status(400).json({ error: 'Invalid price: only free rewards are allowed' });
    }
    // Cap to 60 units (intended max one hour reward). Adjust if business rules change
    if (secondsInt > 60) {
      return res.status(400).json({ error: 'Seconds exceeds allowed limit' });
    }

    // Authorization: ensure caller can only modify their own gizmo account unless admin/staff
    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('id, gizmo_id, is_admin, is_staff')
      .eq('id', userData.user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'Forbidden: user profile not found' });
    }

    const isPrivileged = !!(profile.is_admin || profile.is_staff);
    const ownsGizmo = String(profile.gizmo_id) === String(gizmoId);
    if (!isPrivileged && !ownsGizmo) {
      return res.status(403).json({ error: 'Forbidden: cannot add time for another user' });
    }
    
    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error(`[AMOUNT DEBUG] Request ${requestId} - Missing API configuration`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create base64 encoded auth header
    const gizmoAuthHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    // Use the correct Gizmo API endpoint with price parameter
    const fullUrl = `${apiUrl}/users/${gizmoId}/order/time/${seconds}/price/${price}/invoice`;
    console.log(`[AMOUNT DEBUG] Request ${requestId} - Adding ${secondsInt} seconds to user ${userIdInt} at price ${priceInt} using ${fullUrl}`);

    // Create minimal request body - we may not need to send any data
    // since the URL includes all necessary parameters
    // Some Gizmo API endpoints require an empty object at minimum
    const requestBody = {};

    console.log(`[AMOUNT DEBUG] Request ${requestId} - Request body: ${JSON.stringify(requestBody)}`);

    // Make request to Gizmo API
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': gizmoAuthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    // Get response as text first
    const responseText = await response.text();
    console.log(`[AMOUNT DEBUG] Request ${requestId} - Raw response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    // Then try to parse it as JSON if possible
    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`[AMOUNT DEBUG] Request ${requestId} - Parsed response: ${JSON.stringify(data).substring(0, 200)}`);
    } catch (e) {
      console.error(`[AMOUNT DEBUG] Request ${requestId} - Non-JSON response:`, responseText);
      data = { text: responseText };
    }

    if (!response.ok) {
      console.error(`[AMOUNT DEBUG] Request ${requestId} - Gizmo API error (Status ${response.status}):`, data);
      return res.status(response.status).json({ 
        error: 'Failed to add game time',
        details: typeof data === 'object' ? JSON.stringify(data) : responseText,
        statusCode: response.status
      });
    }

    console.log(`[AMOUNT DEBUG] Request ${requestId} - Game time added successfully:`, data);

    return res.status(200).json({
      result: data.result,
      message: 'Game time added successfully'
    });
  } catch (error) {
    console.error(`[AMOUNT DEBUG] Request handling error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 