// Debug endpoint to test IP detection in production
import { getDetailedIPInfo } from '../../../utils/ip-detection';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ipInfo = getDetailedIPInfo(req);
    
    // Test security logging with detected IP
    try {
      const { logSecurityEvent } = await import('../../../utils/security/notifications');
      
      await logSecurityEvent({
        type: 'ip_detection_test',
        user_id: null,
        username: 'debug_test',
        ip_address: ipInfo.clientIP,
        user_agent: req.headers['user-agent'] || 'unknown',
        attempted_path: '/debug/ip-detection',
        details: `IP detection test from ${req.headers.host}`,
        severity: 'low'
      });

      ipInfo.securityLoggingTest = {
        success: true,
        message: 'Security event logged successfully'
      };
    } catch (loggingError) {
      ipInfo.securityLoggingTest = {
        success: false,
        error: loggingError.message
      };
    }

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      domain: req.headers.host,
      ipDetection: ipInfo,
      recommendations: {
        detectedIP: ipInfo.clientIP,
        isRealIP: ipInfo.clientIP !== 'unknown' && !ipInfo.clientIP.startsWith('127.') && !ipInfo.clientIP.startsWith('::1'),
        hasProxyHeaders: !!(ipInfo.headers['x-forwarded-for'] || ipInfo.headers['cf-connecting-ip'] || ipInfo.headers['x-real-ip']),
        nextSteps: ipInfo.clientIP === 'unknown' ? [
          'Check if your reverse proxy is properly forwarding client IP headers',
          'Verify Cloudflare or other CDN configuration',
          'Consider using a different IP detection method'
        ] : [
          'IP detection is working correctly',
          'Admin access notifications should now work in production'
        ]
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
