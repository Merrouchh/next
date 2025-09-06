/**
 * Utility for detecting client IP addresses in production environments
 * Handles various reverse proxy configurations and load balancers
 */

/**
 * Get the real client IP address from request headers
 * Supports various reverse proxy configurations including Cloudflare, Nginx, etc.
 * 
 * @param {Object} req - Express/Next.js request object
 * @returns {string} - The client IP address or 'unknown' if not found
 */
export function getClientIP(req) {
  // Check various headers that reverse proxies use
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  const trueClientIP = req.headers['true-client-ip']; // Cloudflare Enterprise
  const xClientIP = req.headers['x-client-ip']; // Some proxies
  const xForwarded = req.headers['x-forwarded']; // Some proxies
  
  // Priority order for IP detection (most reliable first)
  if (cfConnectingIP) return cfConnectingIP;
  if (trueClientIP) return trueClientIP;
  if (realIP) return realIP;
  if (xClientIP) return xClientIP;
  if (xForwarded) return xForwarded;
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one (original client)
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fallback to connection info
  return req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Get detailed IP information for debugging
 * 
 * @param {Object} req - Express/Next.js request object
 * @returns {Object} - Detailed IP information
 */
export function getDetailedIPInfo(req) {
  return {
    clientIP: getClientIP(req),
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip'],
      'true-client-ip': req.headers['true-client-ip'],
      'x-client-ip': req.headers['x-client-ip'],
      'x-forwarded': req.headers['x-forwarded']
    },
    connection: {
      remoteAddress: req.connection?.remoteAddress,
      socketRemoteAddress: req.socket?.remoteAddress,
      ip: req.ip
    },
    userAgent: req.headers['user-agent'],
    host: req.headers.host
  };
}
