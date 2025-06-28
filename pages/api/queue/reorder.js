import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Verify admin access
async function verifyAdmin(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  // Check if user is admin or staff
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, is_staff')
    .eq('id', user.id)
    .single();

  if (userError || !userData || (!userData.is_admin && !userData.is_staff)) {
    throw new Error('Admin or staff access required');
  }

  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyAdmin(req.headers.authorization);
    
    const { personId, direction } = req.body;
    
    if (!personId || !direction || !['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Get current person's position
    const { data: currentPerson, error: fetchError } = await supabase
      .from('computer_queue')
      .select('position')
      .eq('id', personId)
      .eq('status', 'waiting')
      .single();

    if (fetchError || !currentPerson) {
      return res.status(404).json({ error: 'Person not found in queue' });
    }

    const currentPosition = currentPerson.position;
    const newPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1;

    // Check boundaries
    const { data: queueCount } = await supabase
      .from('computer_queue')
      .select('id', { count: 'exact' })
      .eq('status', 'waiting');

    const totalInQueue = queueCount?.length || 0;
    
    if (newPosition < 1 || newPosition > totalInQueue) {
      return res.status(400).json({ error: 'Cannot move beyond queue boundaries' });
    }

    // Find the person to swap with
    const { data: swapPerson, error: swapError } = await supabase
      .from('computer_queue')
      .select('id')
      .eq('position', newPosition)
      .eq('status', 'waiting')
      .single();

    if (swapError || !swapPerson) {
      return res.status(400).json({ error: 'Cannot find person to swap with' });
    }

    // Perform position swap

    // Perform the swap using a transaction-like approach
    // First, move current person to a temporary position
    const tempPosition = totalInQueue + 1;
    
    await supabase
      .from('computer_queue')
      .update({ position: tempPosition })
      .eq('id', personId);

    // Move the other person to current person's position
    await supabase
      .from('computer_queue')
      .update({ position: currentPosition })
      .eq('id', swapPerson.id);

    // Move current person to new position
    await supabase
      .from('computer_queue')
      .update({ position: newPosition })
      .eq('id', personId);

    // Positions successfully swapped

    return res.status(200).json({
      success: true,
      message: 'Queue positions updated'
    });

  } catch (error) {
    console.error('Queue reorder error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin or staff access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
} 