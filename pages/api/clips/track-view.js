import { createClient } from '@supabase/supabase-js';
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
    const { clipId, viewerId, isAnonymous, fingerprint, sessionId } = req.body;

    if (!clipId || !viewerId) {
      return res.status(400).json({ error: 'Missing required parameters: clipId and viewerId are required' });
    }

    const rawIp = getClientIp(req);
    const ip = normalizeIp(rawIp);
    const userAgent = req.headers['user-agent'] || '';

    console.log('Received view tracking request:', {
      clipId,
      viewerId,
      fingerprint: fingerprint?.substring(0, 8) + '...',
      sessionId,
      ip,
      userAgent: userAgent?.substring(0, 20) + '...'
    });

    // Create Supabase client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Call the stored procedure to increment view count
    const { data, error } = await supabase.rpc('increment_view_count', {
      clip_id: parseInt(clipId, 10),
      visitor_id: viewerId.toString(),
      is_anonymous: Boolean(isAnonymous),
      device_fingerprint: fingerprint?.toString() || null,
      ip_address: ip?.toString() || null,
      user_agent: userAgent?.toString() || null,
      session_id: sessionId?.toString() || null
    });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Update the clips table view count
    if (typeof data === 'number') {
      await supabase
        .from('clips')
        .update({ views_count: data })
        .eq('id', clipId);
    }

    console.log('View tracked successfully:', { clipId, viewCount: data });
    return res.status(200).json({ viewCount: data });
  } catch (error) {
    console.error('View tracking error:', error);
    return res.status(500).json({ error: 'Failed to track view: ' + error.message });
  }
} 