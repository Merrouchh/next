import { logSecurityEvent } from '../../../utils/security/notifications';
import { getClientIP } from '../../../utils/ip-detection';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      type,
      username,
      attempted_path,
      details,
      severity = 'medium'
    } = req.body;

    // Validate required fields
    if (!type || !attempted_path) {
      return res.status(400).json({ 
        error: 'Missing required fields: type and attempted_path' 
      });
    }

    // Get client information using improved IP detection
    const ip_address = getClientIP(req);
    
    const user_agent = req.headers['user-agent'] || 'unknown';

    // Log the security event
    await logSecurityEvent({
      type,
      user_id: null, // Client-side doesn't have access to user_id
      username: username || 'anonymous',
      ip_address,
      user_agent,
      attempted_path,
      details: details || `Unauthorized access attempt to ${attempted_path}`,
      severity
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Security event logged' 
    });

  } catch (error) {
    console.error('Error logging security event:', error);
    return res.status(500).json({ 
      error: 'Failed to log security event',
      message: error.message 
    });
  }
}
