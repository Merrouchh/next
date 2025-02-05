import createClient from '@/utils/supabase/api';
import { getClientIp } from 'request-ip';

const normalizeIp = (ip) => {
  // Handle localhost IPv6
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  // Handle IPv6 to IPv4 mapping
  if (ip?.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  return ip;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clipId, userId, fingerprint, sessionId } = req.body;
    const rawIp = getClientIp(req);
    const ip = normalizeIp(rawIp);
    const userAgent = req.headers['user-agent'];

    console.log('Processing view:', {
      clipId,
      userId: userId || 'anonymous',
      fingerprint,
      ip
    });

    const supabase = createClient(req, res);

    const { data, error } = await supabase.rpc('increment_view_count', {
      clip_id_param: clipId,
      visitor_id_param: userId || null,  // Explicitly set null for anonymous
      device_fingerprint_param: fingerprint,
      ip_address_param: ip,
      user_agent_param: userAgent,
      session_id_param: sessionId
    });

    if (error) {
      console.error('View tracking error:', error);
      throw error;
    }

    return res.status(200).json({ 
      viewCount: data || 0,
      success: true 
    });
  } catch (error) {
    console.error('View tracking error:', error);
    return res.status(500).json({ 
      error: 'Failed to track view',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 