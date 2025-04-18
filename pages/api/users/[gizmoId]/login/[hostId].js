export default async function handler(req, res) {
  // Only allow POST method for this endpoint
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  try {
    // Get parameters from the URL
    const { gizmoId, hostId } = req.query;

    // Validate parameters
    if (!gizmoId || !hostId) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required parameters',
        message: 'Both gizmoId and hostId are required'
      });
    }

    // Convert to integers
    const userId = parseInt(gizmoId, 10);
    const computerHostId = parseInt(hostId, 10);

    // Additional validation
    if (isNaN(userId) || isNaN(computerHostId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        message: 'Both gizmoId and hostId must be valid numbers'
      });
    }

    console.log(`Attempting to login user ${userId} to host ${computerHostId}`);
    
    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error('Missing API configuration');
      throw new Error('Server configuration error');
    }

    // Create base64 encoded auth header
    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    // Construct the full URL
    const fullUrl = `${apiUrl}/users/${userId}/login/${computerHostId}`;
    console.log('Making request to:', fullUrl);

    // Make request to Gizmo API
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    // Get response data
    const data = await response.json();
    console.log('API response:', data);

    // Check if the operation was successful
    if (response.ok && !data.isError) {
      return res.status(200).json({
        success: true,
        result: data.result,
        message: 'User logged in successfully',
        httpStatusCode: data.httpStatusCode
      });
    } else {
      // If API returned an error message, pass it through
      return res.status(response.ok ? 400 : response.status).json({
        success: false,
        error: data.message || 'Failed to log in user',
        isError: data.isError,
        httpStatusCode: data.httpStatusCode
      });
    }
  } catch (error) {
    console.error('Error during user login:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
} 