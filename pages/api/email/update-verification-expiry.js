import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase admin client with service role key
// This allows us to bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Store last request times for rate limiting
const lastRequestTimes = new Map();
const RATE_LIMIT_SECONDS = 60; // 1 minute between requests

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Rate limiting: Check if user has made a request recently
    const requestKey = `${userId}:${email}`;
    const now = Date.now();
    const lastRequestTime = lastRequestTimes.get(requestKey) || 0;
    const elapsedSeconds = Math.floor((now - lastRequestTime) / 1000);
    
    if (lastRequestTime > 0 && elapsedSeconds < RATE_LIMIT_SECONDS) {
      const remainingSeconds = RATE_LIMIT_SECONDS - elapsedSeconds;
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Please wait ${remainingSeconds} seconds before requesting again`,
        remainingSeconds,
        success: false
      });
    }
    
    // Update the rate limit tracking
    lastRequestTimes.set(requestKey, now);
    
    // Clean up old entries from the rate limit map to prevent memory leaks
    if (lastRequestTimes.size > 1000) {
      // Keep only the 500 most recent entries
      const entries = [...lastRequestTimes.entries()];
      entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
      const recentEntries = entries.slice(0, 500);
      lastRequestTimes.clear();
      for (const [key, time] of recentEntries) {
        lastRequestTimes.set(key, time);
      }
    }
    
    console.log('Updating expiration time for email verification:', { userId, email });
    
    // Use direct SQL to update the expiration time with RETURNING *
    try {
      const updateQuery = `
        UPDATE email_verifications
        SET expires_at = NOW() + INTERVAL '1 hour'
        WHERE user_id = '${userId}'
          AND new_email = '${email}'
          AND status = 'pending'
        RETURNING *;
      `;
      
      const { data: result, error: sqlError } = await supabaseAdmin.rpc(
        'pgexecutesql', 
        { query: updateQuery }
      );
      
      if (sqlError) {
        console.error('SQL error:', sqlError);
        throw new Error(`Failed to update expiration: ${sqlError.message}`);
      }
      
      console.log('SQL result:', result);
      
      if (!result || result.length === 0) {
        return res.status(404).json({ 
          error: 'No pending verification found',
          success: false
        });
      }
      
      // Get the updated record
      return res.status(200).json({ 
        success: true, 
        record: result[0] 
      });
      
    } catch (updateError) {
      console.error('Error during direct SQL update:', updateError);
      
      // Fallback: try standard Supabase update
      try {
        console.log('Attempting standard update as fallback');
        const { data, error } = await supabaseAdmin
          .from('email_verifications')
          .update({
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
          })
          .eq('user_id', userId)
          .eq('new_email', email)
          .eq('status', 'pending')
          .select()
          .single();
          
        if (error) {
          console.error('Fallback update also failed:', error);
          throw new Error(`Standard update failed: ${error.message}`);
        }
        
        console.log('Fallback update succeeded:', data);
        return res.status(200).json({ success: true, record: data });
      } catch (fallbackError) {
        console.error('All update attempts failed:', fallbackError);
        return res.status(500).json({ 
          error: 'Failed to update verification record after multiple attempts', 
          details: fallbackError.message,
          success: false
        });
      }
    }
  } catch (error) {
    console.error('Error in update-verification-expiry API:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred', 
      details: error.message,
      success: false
    });
  }
} 