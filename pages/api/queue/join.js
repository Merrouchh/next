import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(400).json({ error: 'User not found' });
    }

    const { computerType = 'any' } = req.body;

    // Check if queue is active and allows online joining
    const { data: queueStatus } = await supabase.rpc('get_queue_status');
    
    console.log('Queue status from DB:', queueStatus);
    console.log('Queue status type:', typeof queueStatus);
    console.log('Is array?', Array.isArray(queueStatus));
    
    // Handle case where queueStatus is an array
    const status = Array.isArray(queueStatus) ? queueStatus[0] : queueStatus;
    console.log('Final status object:', status);
    
    if (!status || (!status.is_active && !status.automatic_mode)) {
      return res.status(400).json({ error: 'Queue is not currently active' });
    }

    if (!status.allow_online_joining) {
      return res.status(400).json({ error: 'Online joining is not currently allowed' });
    }

    if (status.current_queue_size >= status.max_queue_size) {
      return res.status(400).json({ error: 'Queue is full' });
    }

    // Check if user is already in queue
    const { data: existingEntry } = await supabase
      .from('computer_queue')
      .select('id, position')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .single();

    if (existingEntry) {
      return res.status(400).json({ 
        error: 'You are already in the queue',
        position: existingEntry.position
      });
    }

    // Get next position
    const { data: nextPos } = await supabase.rpc('get_next_queue_position');

    // Add to queue
    const { data: queueEntry, error: insertError } = await supabase
      .from('computer_queue')
      .insert({
        user_name: userData.username,
        computer_type: computerType,
        position: nextPos,
        is_physical: false,
        user_id: user.id
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error joining queue:', insertError);
      return res.status(500).json({ error: 'Failed to join queue' });
    }

    // If automatic mode is on and queue was not active, start it now
    if (status.automatic_mode && !status.is_active && nextPos === 1) {
      await supabase
        .from('queue_settings')
        .update({ is_active: true })
        .eq('id', 1);
      
      console.log('Automatic mode: Started queue system when first person joined');
    }

    return res.status(201).json({
      success: true,
      message: `You joined the queue at position ${nextPos}`,
      data: {
        id: queueEntry.id,
        position: nextPos,
        computerType: computerType,
        estimatedWait: nextPos * 5 // Rough estimate: 5 minutes per person
      }
    });

  } catch (error) {
    console.error('Queue join error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 