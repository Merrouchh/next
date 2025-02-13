import createClient from '../../utils/supabase/api'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.query;
  const supabase = createClient(req, res)  // Create API client with req/res for proper cookie handling

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    console.log('Starting Gizmo ID fetch for username:', username);
    
    const apiUrl = process.env.GIZMO_API_URL;
    const authHeader = `Basic ${Buffer.from(
      `${process.env.GIZMO_API_USERNAME}:${process.env.GIZMO_API_PASSWORD}`
    ).toString('base64')}`;

    // Add timeout and retry logic
    const fetchWithRetry = async (url, options, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              return await response.json();
            } else {
              throw new Error(`Invalid content type: ${contentType}`);
            }
          }

          if (response.status === 522) {
            throw new Error('Connection timed out');
          }

          throw new Error(`API responded with status: ${response.status}`);
        } catch (error) {
          if (i === retries - 1) throw error;
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    };

    const gizmoData = await fetchWithRetry(`${apiUrl}/users/${username}/userid`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (!gizmoData || !gizmoData.id) {
      return res.status(404).json({ error: 'User not found' });
    }

    const gizmoId = gizmoData.id;
    console.log('Found Gizmo ID:', gizmoId);

    // Update Supabase with the Gizmo ID using the API client
    const { error: updateError } = await supabase
      .from('users')
      .update({ gizmo_id: gizmoId })
      .eq('username', username.toLowerCase());

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update user in database',
        details: updateError.message
      });
    }

    return res.status(200).json({ gizmoId: gizmoId });

  } catch (error) {
    console.error('Error fetching gizmo ID:', error);
    
    // More specific error responses
    if (error.message.includes('ECONNRESET') || error.message.includes('timed out')) {
      return res.status(503).json({ 
        error: 'Service temporarily unavailable. Please try again.' 
      });
    }

    if (error.message.includes('content type')) {
      return res.status(502).json({ 
        error: 'Invalid response from server. Please try again.' 
      });
    }

    return res.status(500).json({ 
      error: 'Failed to fetch user ID. Please try again later.' 
    });
  }
}
