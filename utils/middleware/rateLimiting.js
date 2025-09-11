/**
 * Rate limiting middleware to prevent API abuse
 */

import { getClientIP } from '../ip-detection';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter configuration
 */
const RATE_LIMITS = {
  // Game time API - very restrictive
  'game-time': { requests: 3, window: 60 * 60 * 1000 }, // 3 requests per hour
  
  // Admin APIs - moderate
  'admin': { requests: 100, window: 60 * 1000 }, // 100 requests per minute
  
  // Auth APIs - restrictive for brute force protection
  'auth': { requests: 10, window: 15 * 60 * 1000 }, // 10 requests per 15 minutes
  
  // General API - moderate
  'general': { requests: 60, window: 60 * 1000 }, // 60 requests per minute
  
  // Database operations - moderate
  'database': { requests: 30, window: 60 * 1000 }, // 30 requests per minute
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(req) {
  // Try to get user ID from authenticated session first
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      // Extract user info from token if possible
      const token = authHeader.replace('Bearer ', '');
      // In a real implementation, you'd decode the JWT to get user ID
      // For now, use a hash of the token
      return `user_${token.slice(-10)}`;
    } catch {
      // Fall back to IP if token parsing fails
    }
  }
  
  // Fall back to IP address using improved detection
  const ip = getClientIP(req);
  return `ip_${ip}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(limitType = 'general') {
  return async (req, res, next) => {
    try {
      const limit = RATE_LIMITS[limitType];
      if (!limit) {
        console.warn(`Unknown rate limit type: ${limitType}`);
        return next();
      }

      const clientId = getClientId(req);
      const key = `${limitType}_${clientId}`;
      const now = Date.now();
      
      // Get current rate limit data
      let rateLimitData = rateLimitStore.get(key);
      
      // Initialize or reset if window has passed
      if (!rateLimitData || now > rateLimitData.resetTime) {
        rateLimitData = {
          count: 0,
          resetTime: now + limit.window,
          firstRequest: now
        };
      }
      
      // Check if limit exceeded
      if (rateLimitData.count >= limit.requests) {
        const timeUntilReset = Math.ceil((rateLimitData.resetTime - now) / 1000);
        
        // Log rate limit violation
        console.warn(`Rate limit exceeded for ${clientId} on ${limitType} API. Reset in ${timeUntilReset}s`);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${timeUntilReset} seconds.`,
          retryAfter: timeUntilReset,
          limit: limit.requests,
          window: Math.ceil(limit.window / 1000)
        });
      }
      
      // Increment counter and store
      rateLimitData.count++;
      rateLimitStore.set(key, rateLimitData);
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.requests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit.requests - rateLimitData.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));
      
      // Continue to next middleware
      if (next) next();
      
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Don't block requests if rate limiting fails
      if (next) next();
    }
  };
}

/**
 * Apply rate limiting to API handler
 */
export function withRateLimit(handler, limitType = 'general') {
  return async (req, res) => {
    const rateLimitMiddleware = rateLimit(limitType);
    
    return new Promise((resolve, reject) => {
      rateLimitMiddleware(req, res, (error) => {
        if (error) {
          reject(error);
        } else if (res.headersSent) {
          // Rate limit was hit, response already sent
          resolve();
        } else {
          // Continue to handler
          handler(req, res).then(resolve).catch(reject);
        }
      });
    });
  };
}
