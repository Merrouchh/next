export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`Fetching username for user ID: ${userId}`);
    
    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      throw new Error('Missing API configuration');
    }

    // Create base64 encoded auth header
    const authHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    // First try the main user endpoint
    const fullUrl = `${apiUrl}/users/${userId}`;
    console.log('Making request to:', fullUrl);

    // Make request to Gizmo API
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('User API response:', data);
      
      if (data && data.result) {
        // Extract username from response
        const username = data.result.name || data.result.username || data.result.userName || null;
        
        if (username) {
          return res.status(200).json({ 
            username: username,
            success: true
          });
        }
      }
    }
    
    // If first approach failed, try user info endpoint
    const userInfoUrl = `${apiUrl}/users/${userId}/info`;
    console.log('Trying alternative endpoint:', userInfoUrl);
    
    const infoResponse = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log('User info API response:', infoData);
      
      if (infoData && infoData.result) {
        const username = infoData.result.name || infoData.result.username || infoData.result.userName || null;
        
        if (username) {
          return res.status(200).json({ 
            username: username,
            success: true
          });
        }
      }
    }
    
    // If all API calls failed, return a failure response
    return res.status(200).json({ 
      username: null,
      success: false,
      error: 'Username not found for this user ID'
    });

  } catch (error) {
    console.error('Error fetching username:', error);
    return res.status(500).json({ 
      username: null,
      success: false,
      error: error.message
    });
  }
} 