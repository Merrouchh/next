import { authenticateRequest } from '../../../utils/supabase/secure-server';
import { withRateLimit } from '../../../utils/middleware/rateLimiting';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SECURITY: Require authentication to access user points
  const authResult = await authenticateRequest(req, res);
  if (!authResult.authenticated) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: authResult.error 
    });
  }

  const { gizmoId } = req.query;
  const { user } = authResult;

  if (!gizmoId) {
    return res.status(400).json({ error: 'Gizmo ID is required' });
  }

  // SECURITY: Users can only access their own points unless admin/staff
  const isPrivileged = !!(user.isAdmin || user.isStaff);
  const ownsGizmo = String(user.gizmo_id) === String(gizmoId);
  
  if (!isPrivileged && !ownsGizmo) {
    return res.status(403).json({ 
      error: 'Forbidden: can only access your own points' 
    });
  }

  try {
    console.log('Fetching points for Gizmo ID:', gizmoId);
    
    // Create Basic Auth header from environment variables
    const auth = process.env.API_AUTH;
    if (!auth) {
      throw new Error('API_AUTH environment variable is not set');
    }
    
    const authHeader = 'Basic ' + Buffer.from(auth).toString('base64');
    const apiUrl = process.env.API_BASE_URL;
    
    // Call Gizmo API to get user points
    const pointsResponse = await fetch(`${apiUrl}/users/${gizmoId}/points`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    console.log('Points API Response Status:', pointsResponse.status);
    const pointsData = await pointsResponse.json();
    console.log('Points API Response:', pointsData);

    if (!pointsResponse.ok) {
      return res.status(pointsResponse.status).json({ 
        error: 'Gizmo API error',
        details: pointsData
      });
    }

    // SECURITY: Log points access for audit
    console.log(`[AUDIT] User ${user.username} accessed points for gizmo ${gizmoId}`);
    return res.status(200).json(pointsData);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Internal server error'
    });
  }
}

// Export with rate limiting
export default withRateLimit(handler, 'general');
