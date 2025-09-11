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

    // Check if this gizmo_id already received a reward
    const { data: existingReward } = await supabase
      .from('game_time_rewards')
      .select('id, created_at, seconds_added, user_id')
      .eq('gizmo_id', userData.gizmo_id)
      .single();

    if (existingReward) {
      console.log(`[INTERNAL API] Gizmo ID ${userData.gizmo_id} already received reward`);
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

    // Record the reward in the database
    const { error: recordError } = await supabase
      .from('game_time_rewards')
      .insert({
        gizmo_id: userData.gizmo_id,
        user_id: userData.id,
        seconds_added: seconds,
        price: price,
        reward_type: 'achievement'
      });

    if (recordError) {
      console.error('[INTERNAL API] Error recording reward:', recordError);
      // Don't fail the request if recording fails, but log it
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
