import { createClient } from '@supabase/supabase-js';
import { getClientIp } from 'request-ip';

export default async function handler(req, res) {
  console.log('[Direct API] --- REQUEST START ---');
  console.log('[Direct API] Method:', req.method);
  console.log('[Direct API] Body:', {
    clipId: req.body?.clipId,
    viewerId: req.body?.viewerId?.substring(0, 8) + '...'
  });
  
  if (req.method !== 'POST') {
    console.log('[Direct API] Error: Method not allowed');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { clipId, viewerId, fingerprint, sessionId } = req.body;

    if (!clipId || !viewerId) {
      console.log('[Direct API] Error: Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters: clipId and viewerId are required' });
    }

    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    console.log('[Direct API] Processing insertion:', {
      clipId,
      viewerId: viewerId.substring(0, 8) + '...'
    });

    // Create Supabase client with service role key
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Direct API] Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Check if this view is a duplicate (same visitor viewed same clip recently)
    console.log('[Direct API] Checking for duplicates');
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    // Check if user ID contains 'anon_' to determine if it's an anonymous user
    const isAnonymous = viewerId.toString().startsWith('anon_');
    console.log('[Direct API] User type:', isAnonymous ? 'Anonymous' : 'Logged-in');
    
    let isDuplicate = false;
    
    // For logged-in users, only check by user ID
    if (!isAnonymous) {
      console.log('[Direct API] Checking for logged-in user duplicate by user ID');
      const { data: userViews, error: userCheckError } = await supabase
        .from('clip_views')
        .select('id, created_at')
        .eq('clip_id', clipId)
        .eq('visitor_id', viewerId)
        .gte('created_at', sixHoursAgo.toISOString())
        .limit(1);
        
      if (userCheckError) {
        console.error('[Direct API] Error checking user duplicates:', userCheckError);
      } else if (userViews?.length > 0) {
        console.log('[Direct API] Found duplicate view for logged-in user');
        isDuplicate = true;
      }
    } else {
      // For anonymous users, check both by ID and device fingerprint
      console.log('[Direct API] Checking for anonymous user duplicate');
      const { data: anonViews, error: anonCheckError } = await supabase
        .from('clip_views')
        .select('id, created_at')
        .eq('clip_id', clipId)
        .eq('visitor_id', viewerId)
        .gte('created_at', sixHoursAgo.toISOString())
        .limit(1);
        
      if (anonCheckError) {
        console.error('[Direct API] Error checking anon duplicates:', anonCheckError);
      } else if (anonViews?.length > 0) {
        console.log('[Direct API] Found duplicate view for anonymous user');
        isDuplicate = true;
      } else if (fingerprint) {
        // If no duplicate by ID, also check fingerprint for anonymous users
        const { data: fingerprintViews, error: fingerprintCheckError } = await supabase
          .from('clip_views')
          .select('id, created_at')
          .eq('clip_id', clipId)
          .eq('device_fingerprint', fingerprint)
          .ilike('visitor_id', 'anon_%')  // Only match anonymous users
          .gte('created_at', sixHoursAgo.toISOString())
          .limit(1);
          
        if (fingerprintCheckError) {
          console.error('[Direct API] Error checking fingerprint duplicates:', fingerprintCheckError);
        } else if (fingerprintViews?.length > 0) {
          console.log('[Direct API] Found duplicate view by fingerprint for anonymous user');
          isDuplicate = true;
        }
      }
    }
    
    if (isDuplicate) {
      console.log('[Direct API] Duplicate detected - view already exists');
      console.log('[Direct API] --- REQUEST COMPLETE (DUPLICATE) ---');
      return res.status(200).json({ 
        success: true, 
        duplicate: true,
        message: 'Duplicate view - not counted'
      });
    }

    // 2. Insert a view record
    console.log('[Direct API] Inserting view record');
    const { error: insertError } = await supabase
      .from('clip_views')
      .insert({
        clip_id: parseInt(clipId, 10),
        visitor_id: viewerId,
        device_fingerprint: fingerprint || null,
        ip_address: ip,
        user_agent: userAgent,
        session_id: sessionId || null
      });

    if (insertError) {
      console.error('[Direct API] Insert error:', insertError);
      return res.status(500).json({ 
        error: 'Failed to insert view record', 
        details: insertError.message
      });
    }

    // 3. Update the view count in the clips table
    console.log('[Direct API] Updating view count');
    const { data: updateData, error: updateError } = await supabase
      .from('clips')
      .update({ views_count: supabase.raw('views_count + 1') })
      .eq('id', clipId)
      .select('views_count')
      .single();

    if (updateError) {
      console.error('[Direct API] Update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update view count', 
        details: updateError.message
      });
    }

    console.log('[Direct API] View inserted successfully, count:', updateData?.views_count);
    console.log('[Direct API] --- REQUEST COMPLETE ---');
    return res.status(200).json({ 
      success: true, 
      duplicate: false,
      viewCount: updateData?.views_count,
      message: 'View tracked successfully'
    });
  } catch (error) {
    console.error('[Direct API] Error:', error);
    console.log('[Direct API] --- REQUEST FAILED ---');
    return res.status(500).json({ 
      error: 'Failed to track view', 
      message: error.message
    });
  }
} 