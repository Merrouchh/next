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

    // Get the current queue directly from computer_queue table to ensure we get all data
    const { data: queueData, error: queueError } = await supabase
      .from('computer_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('position');

    if (queueError) {
      console.error('Error getting queue data:', queueError);
      return res.status(500).json({ error: 'Failed to get queue data' });
    }

    // Ensure status is always an object, not an array
    const status = Array.isArray(statusData) ? statusData[0] : statusData;
    
    // Calculate breakdown counts by computer type from queue data
    const queueBreakdown = {
      any_queue_count: 0,
      bottom_queue_count: 0,
      top_queue_count: 0
    };

    if (queueData && Array.isArray(queueData)) {
      queueData.forEach(entry => {
        if (entry.status === 'waiting') {
          switch (entry.computer_type) {
            case 'any':
              queueBreakdown.any_queue_count++;
              break;
            case 'bottom':
              queueBreakdown.bottom_queue_count++;
              break;
            case 'top':
              queueBreakdown.top_queue_count++;
              break;
            default:
              // Default to 'any' for backward compatibility
              queueBreakdown.any_queue_count++;
              break;
          }
        }
      });
    }

    // Add breakdown counts to status
    const enrichedStatus = {
      ...status,
      ...queueBreakdown
    };
    
    return res.status(200).json({
      status: enrichedStatus,
      queue: queueData || []
    });

  } catch (error) {
    console.error('Queue status API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 