import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for adding game time rewards
 * This API handles authentication server-side and calls the original API internally
 * This prevents authorization headers from being exposed to the client
 */
async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the parameters from the request body
    const { userId, seconds, price = 0 } = req.body;

    // Basic validation
    if (!userId || !seconds) {
      return res.status(400).json({ 
        error: 'Invalid request parameters',
        details: 'userId and seconds are required'
      });
    }

    // Validate that seconds is exactly 3600 (1 hour)
    if (seconds !== 3600) {
      return res.status(400).json({ 
        error: 'Invalid time amount',
        details: 'Only 3600 seconds (1 hour) is allowed'
      });
    }

    // Create Supabase client with service role key for server-side operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get user data to verify they exist and get their gizmo_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, gizmo_id')
      .eq('id', userId)
      .single();

    if (userError || !userData?.gizmo_id) {
      console.error('Error getting user data:', userError);
      return res.status(404).json({ 
        success: false,
        error: 'User not found or no gaming account linked',
        details: userError?.message 
      });
    }

    // SECURITY CHECK: Verify this gizmo_id hasn't already received a reward
    // This check is critical to prevent abuse where users delete their record and claim again
    // Note: The game_time_rewards table has RLS enabled to prevent users from deleting records
    const { data: existingReward, error: checkError } = await supabase
      .from('game_time_rewards')
      .select('id, created_at, seconds_added, user_id')
      .eq('gizmo_id', userData.gizmo_id)
      .single();

    // Log any errors during check (except 'not found' which is expected)
    if (checkError && checkError.code !== 'PGRST116') {
      console.error(`[INTERNAL API] Error checking existing rewards:`, checkError);
    }

    if (existingReward) {
      console.log(`[INTERNAL API] SECURITY: Gizmo ID ${userData.gizmo_id} already received reward. Rejecting duplicate claim.`);
      return res.status(400).json({
        success: false,
        error: 'Reward already claimed',
        message: `This gaming account already received ${existingReward.seconds_added} seconds on ${new Date(existingReward.created_at).toLocaleDateString()}`,
        details: {
          gizmo_id: userData.gizmo_id,
          previous_reward: existingReward.seconds_added,
          claimed_at: existingReward.created_at
        }
      });
    }

    console.log(`[INTERNAL API] Adding ${seconds} seconds to user ${userData.username} (gizmo_id: ${userData.gizmo_id})`);

    // Get API credentials from environment variables
    const apiUrl = process.env.API_BASE_URL;
    const apiAuth = process.env.API_AUTH;

    if (!apiUrl || !apiAuth) {
      console.error('[INTERNAL API] Missing API configuration');
      return res.status(500).json({ 
        success: false,
        error: 'Server configuration error' 
      });
    }

    // IMPORTANT: The API treats seconds as MINUTES, so convert
    const apiAmount = Math.round(seconds / 60);
    
    console.log(`[INTERNAL API] Original request: ${seconds} seconds (${seconds/3600} hours)`);
    console.log(`[INTERNAL API] CORRECTED amount: ${apiAmount} units (should be 60 minutes = 1 hour)`);

    // Create base64 encoded auth header for the external API
    const gizmoAuthHeader = `Basic ${Buffer.from(apiAuth).toString('base64')}`;
    
    // Call the external Gizmo API internally (server-to-server)
    const fullUrl = `${apiUrl}/users/${userData.gizmo_id}/order/time/${apiAmount}/price/${price}/invoice`;
    console.log(`[INTERNAL API] Calling external API: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': gizmoAuthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    // Get response as text first
    const responseText = await response.text();
    console.log(`[INTERNAL API] External API response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[INTERNAL API] Non-JSON response:', responseText);
      data = { text: responseText };
    }

    if (!response.ok) {
      console.error(`[INTERNAL API] External API error (Status ${response.status}):`, data);
      return res.status(response.status).json({ 
        success: false,
        error: 'Failed to add game time',
        details: typeof data === 'object' ? JSON.stringify(data) : responseText,
        statusCode: response.status
      });
    }

    console.log(`[INTERNAL API] Game time added successfully for user ${userData.username}`);

    // CRITICAL: Record the reward in the database to prevent duplicate claims
    // This uses service role which bypasses RLS, so it should always succeed
    const { data: insertedRecord, error: recordError } = await supabase
      .from('game_time_rewards')
      .insert({
        gizmo_id: userData.gizmo_id,
        user_id: userData.id,
        seconds_added: seconds,
        price: price,
        reward_type: 'achievement'
      })
      .select()
      .single();

    if (recordError) {
      // CRITICAL ERROR: User received the reward but we couldn't record it
      // This means they could potentially claim it again
      // Log this as a critical security issue that needs manual review
      console.error('[INTERNAL API] CRITICAL SECURITY ERROR: Failed to record reward in database!', {
        user_id: userData.id,
        gizmo_id: userData.gizmo_id,
        username: userData.username,
        seconds: seconds,
        error: recordError,
        timestamp: new Date().toISOString()
      });
      
      // Still return success since the user did receive the time
      // but flag this for manual review
      return res.status(200).json({
        success: true,
        result: data.result,
        message: 'Game time added successfully',
        warning: 'Reward record could not be saved - please contact support',
        user: {
          username: userData.username,
          gizmo_id: userData.gizmo_id
        },
        audit: {
          timestamp: new Date().toISOString(),
          action: `Added ${seconds}s (${seconds/3600}h) to user ${userData.username}`,
          gizmo_id: userData.gizmo_id,
          recording_failed: true
        }
      });
    }

    // Verify the record was actually inserted
    if (!insertedRecord) {
      console.error('[INTERNAL API] WARNING: Insert returned no error but no record created');
    } else {
      console.log(`[INTERNAL API] Reward record created successfully: ID ${insertedRecord.id}`);
    }

    return res.status(200).json({
      success: true,
      result: data.result,
      message: 'Game time added successfully',
      user: {
        username: userData.username,
        gizmo_id: userData.gizmo_id
      },
      audit: {
        timestamp: new Date().toISOString(),
        action: `Added ${seconds}s (${seconds/3600}h) to user ${userData.username}`,
        gizmo_id: userData.gizmo_id
      }
    });

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process game time reward request'
    });
  }
}

// Export handler
export default handler;
