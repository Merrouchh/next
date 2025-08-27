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
  console.log('[View API] --- REQUEST START ---');
  console.log('[View API] Method:', req.method);
  console.log('[View API] Body:', {
    clipId: req.body?.clipId,
    viewerId: req.body?.viewerId?.substring(0, 8) + '...',
    isAnonymous: req.body?.isAnonymous
  });
  
  if (req.method !== 'POST') {
    console.log('[View API] Error: Method not allowed');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clipId, viewerId, isAnonymous, fingerprint, sessionId } = req.body;

    if (!clipId || !viewerId) {
      console.log('[View API] Error: Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters: clipId and viewerId are required' });
    }

    const rawIp = getClientIp(req);
    const ip = normalizeIp(rawIp);
    const userAgent = req.headers['user-agent'] || '';

    console.log('[View API] Processing with params:', {
      clipId,
      viewerId: viewerId.substring(0, 8) + '...',
      fingerprint: fingerprint?.substring(0, 8) + '...',
      ip
    });

    // Create Supabase client with service role key
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[View API] Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

    // Verify the clip exists first
    console.log('[View API] Checking clip existence:', clipId);
    const { data: clipData, error: clipError } = await supabase
      .from('clips')
      .select('id')
      .eq('id', clipId)
      .single();

    if (clipError || !clipData) {
      console.error('[View API] Clip not found:', clipError);
      return res.status(404).json({ error: 'Clip not found' });
    }
    
    // Call the stored procedure to increment view count
    console.log('[View API] Calling increment_view_count function');
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
      console.error('[View API] RPC error:', error);
      
      // Check if it's a "function does not exist" error
      if (error.message && error.message.includes('function') && error.message.includes('not exist')) {
        console.error('[View API] Function does not exist error - need to run migration');
        return res.status(500).json({ 
          error: 'The increment_view_count function does not exist in the database. Please run the SQL migration first.',
          details: error.message
        });
      }
      
      throw error;
    }

    // Direct DB operation as fallback if the function doesn't work correctly
    if (data === null || data === undefined) {
      console.log('[View API] Function returned null, trying direct insert as fallback');
      
      try {
        // Add a direct entry to clip_views
        console.log('[View API] Inserting view record directly');
        const { error: insertError } = await supabase
          .from('clip_views')
          .insert({
            clip_id: parseInt(clipId, 10),
            visitor_id: viewerId.toString(),
            device_fingerprint: fingerprint?.toString() || null,
            ip_address: ip?.toString() || null,
            user_agent: userAgent?.toString() || null,
            session_id: sessionId?.toString() || null
          });
          
        if (insertError) {
          console.error('[View API] Insert error:', insertError);
          throw insertError;
        }
        
        console.log('[View API] Updating clip view count');
        // Update the view count in clips table
        const { data: updateData, error: updateError } = await supabase
          .from('clips')
          .update({ views_count: supabase.raw('views_count + 1') })
          .eq('id', clipId)
          .select('views_count')
          .single();
            
        if (updateError) {
          console.error('[View API] Update error:', updateError);
          throw updateError;
        }
        
        console.log('[View API] Direct update successful, new count:', updateData?.views_count);
        console.log('[View API] --- REQUEST COMPLETE ---');
        return res.status(200).json({ viewCount: updateData?.views_count || 1 });
      } catch (directDbError) {
        console.error('[View API] Direct DB error:', directDbError);
        throw directDbError;
      }
    }

    console.log('[View API] View tracked successfully, new count:', data);
    console.log('[View API] --- REQUEST COMPLETE ---');
    return res.status(200).json({ viewCount: data });
  } catch (error) {
    console.error('[View API] Error tracking view:', error);
    console.log('[View API] --- REQUEST FAILED ---');
    return res.status(500).json({ 
      error: 'Failed to track view', 
      message: error.message
    });
  }
} 