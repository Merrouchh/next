import { authenticateRequest } from '../../utils/supabase/secure-server';
import { withRateLimit } from '../../utils/middleware/rateLimiting';

async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // SECURITY: Require authentication to view active sessions
    const authResult = await authenticateRequest(req, res);
    if (!authResult.authenticated) {
      return res.status(401).json({ 
        message: 'Authentication required',
        error: authResult.error 
      });
    }

    // Allow all authenticated users to view active sessions
    const { user } = authResult;
  
    const apiUrl = `${process.env.API_BASE_URL}/usersessions/active`;
  
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.API_AUTH).toString('base64')}`, // Base64 encode API_AUTH
        },
      });
  
      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        return res.status(response.status).json({ message: 'Failed to fetch active sessions' });
      }
  
      const data = await response.json();
      // SECURITY: Log admin access to sessions
      console.log(`[AUDIT] User ${user.username} accessed active sessions`);
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching active user sessions:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

// Export with rate limiting for general users
export default withRateLimit(handler, 'general');
  