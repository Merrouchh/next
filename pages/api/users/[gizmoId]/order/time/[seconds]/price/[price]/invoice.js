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
    // Convert to integers
    const secondsInt = parseInt(seconds, 10);
    const userIdInt = parseInt(gizmoId, 10);
    const priceInt = parseInt(price, 10);
    
    console.log(`[AMOUNT DEBUG] Request ${requestId} - Parsed values: secondsInt=${secondsInt}, userIdInt=${userIdInt}, priceInt=${priceInt}`);
    
    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error(`[AMOUNT DEBUG] Request ${requestId} - Missing API configuration`);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Create base64 encoded auth header
    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
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
        'Authorization': authHeader,
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