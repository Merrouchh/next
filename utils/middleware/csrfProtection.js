/**
 * CSRF Protection Middleware
 */

import crypto from 'crypto';

// In-memory store for CSRF tokens (use Redis in production)
const csrfTokenStore = new Map();

// Clean up expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokenStore.entries()) {
    if (now > data.expiresAt) {
      csrfTokenStore.delete(token);
    }
  }
}, 30 * 60 * 1000);

/**
 * Generate CSRF token
 */
export function generateCSRFToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (2 * 60 * 60 * 1000); // 2 hours
  
  csrfTokenStore.set(token, {
    sessionId,
    expiresAt,
    used: false
  });
  
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token, sessionId) {
  if (!token || !sessionId) return false;
  
  const tokenData = csrfTokenStore.get(token);
  if (!tokenData) return false;
  
  // Check if token is expired
  if (Date.now() > tokenData.expiresAt) {
    csrfTokenStore.delete(token);
    return false;
  }
  
  // Check if token belongs to the session
  if (tokenData.sessionId !== sessionId) return false;
  
  // Check if token was already used (optional: one-time use)
  if (tokenData.used) return false;
  
  // Mark token as used
  tokenData.used = true;
  
  return true;
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(options = {}) {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    headerName = 'x-csrf-token',
    // cookieName = 'csrf-token' // Removed unused variable
  } = options;
  
  return async (req, res, next) => {
    try {
      // Skip CSRF check for safe methods
      if (ignoreMethods.includes(req.method)) {
        if (next) next();
        return;
      }
      
      // Get session ID (you might need to adjust this based on your auth system)
      const sessionId = req.headers.authorization || req.headers.cookie || 'anonymous';
      
      // Get CSRF token from header or body
      const csrfToken = req.headers[headerName] || req.body?.csrfToken;
      
      if (!csrfToken) {
        return res.status(403).json({
          error: 'CSRF token missing',
          message: 'CSRF token is required for this request'
        });
      }
      
      // Validate CSRF token
      if (!validateCSRFToken(csrfToken, sessionId)) {
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'CSRF token is invalid or expired'
        });
      }
      
      // Continue to next middleware
      if (next) next();
      
    } catch (error) {
      console.error('CSRF protection error:', error);
      return res.status(500).json({
        error: 'CSRF validation failed',
        message: 'An error occurred during CSRF validation'
      });
    }
  };
}

/**
 * Apply CSRF protection to API handler
 */
export function withCSRFProtection(handler, options = {}) {
  return async (req, res) => {
    const csrfMiddleware = csrfProtection(options);
    
    return new Promise((resolve, reject) => {
      csrfMiddleware(req, res, (error) => {
        if (error) {
          reject(error);
        } else if (res.headersSent) {
          // CSRF check failed, response already sent
          resolve();
        } else {
          // Continue to handler
          handler(req, res).then(resolve).catch(reject);
        }
      });
    });
  };
}

/**
 * API endpoint to get CSRF token
 */
export function createCSRFTokenEndpoint() {
  return async (req, res) => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
      // Get session ID
      const sessionId = req.headers.authorization || req.headers.cookie || 'anonymous';
      
      // Generate new CSRF token
      const csrfToken = generateCSRFToken(sessionId);
      
      return res.status(200).json({
        csrfToken,
        expiresIn: 2 * 60 * 60 * 1000 // 2 hours in milliseconds
      });
      
    } catch (error) {
      console.error('CSRF token generation error:', error);
      return res.status(500).json({
        error: 'Failed to generate CSRF token'
      });
    }
  };
}
