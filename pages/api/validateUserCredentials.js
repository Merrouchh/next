// pages/api/validateUserCredentials.js
import { authenticateRequest } from '../../utils/supabase/secure-server';
import { withRateLimit } from '../../utils/middleware/rateLimiting';

async function handler(req, res) {
    // SECURITY: Remove dangerous CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://merrouchgaming.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // SECURITY: Require authentication for credential validation
    const authResult = await authenticateRequest(req, res);
    if (!authResult.authenticated) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: authResult.error 
      });
    }

    // Allow any authenticated user to validate credentials for account linking
    const { user } = authResult;
  
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
          'Content-Type': 'application/json'
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
      // SECURITY: Don't log sensitive credential validation responses
      console.log(`[AUDIT] User ${user.username} validated credentials for ${username}`);
  
      // Pass the data back to the client
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in validateUserCredentials:', error);
      // SECURITY: Don't leak internal error details
      return res.status(500).json({ 
        message: error.name === 'AbortError' 
          ? 'Request timed out' 
          : 'Internal Server Error',
        isError: true
      });
    }
  }

// Export with rate limiting and auth
export default withRateLimit(handler, 'general');
  