// pages/api/validateUserCredentials.js
export default async function handler(req, res) {
    // Add CORS headers to help with privacy-focused browsers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    const { username, password } = req.body; // Extract username and password
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
  
    const apiUrl = `${process.env.API_BASE_URL}/users/${encodeURIComponent(username)}/${encodeURIComponent(password)}/valid`;
  
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: 'Basic ' + Buffer.from(process.env.API_AUTH).toString('base64'), // Use Buffer instead of btoa for compatibility
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        return res.status(response.status).json({ 
          message: 'Failed to fetch user credentials',
          status: response.status,
          isError: true
        });
      }
  
      const data = await response.json();
      console.log('External API Response:', data);
  
      // Pass the data back to the client
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in validateUserCredentials:', error);
      // Provide more detailed error information
      return res.status(500).json({ 
        message: error.name === 'AbortError' 
          ? 'Request timed out' 
          : 'Internal Server Error',
        error: error.message,
        isError: true
      });
    }
  }
  