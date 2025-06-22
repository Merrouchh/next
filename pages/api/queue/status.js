import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get queue status using the stored function
    const { data: statusData, error: statusError } = await supabase
      .rpc('get_queue_status');

    if (statusError) {
      console.error('Error getting queue status:', statusError);
      return res.status(500).json({ error: 'Failed to get queue status' });
    }

    // Get the current queue
    const { data: queueData, error: queueError } = await supabase
      .from('queue_display')
      .select('*')
      .order('position');

    if (queueError) {
      console.error('Error getting queue data:', queueError);
      return res.status(500).json({ error: 'Failed to get queue data' });
    }

    // Ensure status is always an object, not an array
    const status = Array.isArray(statusData) ? statusData[0] : statusData;
    
    return res.status(200).json({
      status: status,
      queue: queueData || []
    });

  } catch (error) {
    console.error('Queue status API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 