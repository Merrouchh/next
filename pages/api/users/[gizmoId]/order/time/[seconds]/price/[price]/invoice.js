import crypto from 'crypto';
import { authenticateRequest } from '@/utils/supabase/secure-server';
import { withRateLimit } from '@/utils/middleware/rateLimiting';
import { validateRequestBody, VALIDATION_SCHEMAS } from '@/utils/validation/inputValidation';

async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get parameters from URL path
  const { gizmoId, seconds, price } = req.query;
  
  // Log request details including headers (but not sensitive data)
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  
  console.log(`[SECURITY] Game time request ${requestId} from IP ${clientIp}`);
  console.log(`[SECURITY] - Params: gizmoId=${gizmoId}, seconds=${seconds}, price=${price}`);
  
  // Validate input parameters using validation schema
  const validation = validateRequestBody(
    { gizmoId, seconds, price },
    VALIDATION_SCHEMAS.gameTimeRequest
  );
  
  if (!validation.isValid) {
    console.warn(`[SECURITY] Request ${requestId} validation failed:`, validation.errors);
    return res.status(400).json({ 
      error: 'Invalid request parameters',
      details: validation.errors
    });
  }
  
  const { gizmoId: validatedGizmoId, seconds: validatedSeconds, price: validatedPrice } = validation.sanitized;

  try {
    // Authenticate request with secure server-side Supabase
    const authResult = await authenticateRequest(req, res);
    if (!authResult.authenticated) {
      return res.status(401).json({ error: `Unauthorized: ${authResult.error}` });
    }

    const { user: authenticatedUser } = authResult;

    // Use validated parameters
    const secondsInt = validatedSeconds;
    const userIdInt = validatedGizmoId;
    const priceInt = validatedPrice;
    
    console.log(`[SECURITY] Request ${requestId} - Validated values: secondsInt=${secondsInt}, userIdInt=${userIdInt}, priceInt=${priceInt}`);

    // Authorization: ensure caller can only modify their own gizmo account unless admin/staff
    const isPrivileged = !!(authenticatedUser.isAdmin || authenticatedUser.isStaff);
    const ownsGizmo = String(authenticatedUser.gizmo_id) === String(userIdInt);
    
    if (!isPrivileged && !ownsGizmo) {
      console.warn(`[SECURITY] Request ${requestId} - Unauthorized access attempt by user ${authenticatedUser.id} for gizmo ${userIdInt}`);
      return res.status(403).json({ error: 'Forbidden: cannot add time for another user' });
    }
    
    // Additional security: Log all game time additions for audit
    console.log(`[AUDIT] User ${authenticatedUser.username} (${authenticatedUser.id}) adding ${secondsInt}s to gizmo ${userIdInt} [${isPrivileged ? 'ADMIN' : 'OWNER'}]`);
    
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
    } catch {
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

    console.log(`[SECURITY] Request ${requestId} - Game time added successfully:`, data);

    return res.status(200).json({
      result: data.result,
      message: 'Game time added successfully',
      audit: {
        requestId,
        timestamp: new Date().toISOString(),
        user: authenticatedUser.username,
        action: `Added ${secondsInt}s to gizmo ${userIdInt}`
      }
    });
  } catch (error) {
    console.error(`[SECURITY] Request ${requestId} handling error:`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process game time request',
      requestId
    });
  }
}

// Export with rate limiting applied
export default withRateLimit(handler, 'game-time'); 