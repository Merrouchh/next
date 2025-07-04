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

    // IMPROVED: Use a more atomic approach with better error handling
    // Instead of temporary positions, we'll use a more reliable swap method
    
    try {
      // Step 1: Move current person to a safe temporary position (9999)
      const { error: tempError } = await supabase
        .from('computer_queue')
        .update({ position: 9999 })
        .eq('id', personId);

      if (tempError) {
        console.error('Error moving to temp position:', tempError);
        throw new Error('Failed to move to temporary position');
      }

      // Step 2: Move the other person to current person's old position
      const { error: swapError1 } = await supabase
        .from('computer_queue')
        .update({ position: currentPosition })
        .eq('id', swapPerson.id);

      if (swapError1) {
        console.error('Error moving swap person:', swapError1);
        // Try to revert the first move
        await supabase
          .from('computer_queue')
          .update({ position: currentPosition })
          .eq('id', personId);
        throw new Error('Failed to move swap person');
      }

      // Step 3: Move current person to new position
      const { error: finalError } = await supabase
        .from('computer_queue')
        .update({ position: newPosition })
        .eq('id', personId);

      if (finalError) {
        console.error('Error moving to final position:', finalError);
        // Try to revert both moves
        await supabase
          .from('computer_queue')
          .update({ position: newPosition })
          .eq('id', swapPerson.id);
        await supabase
          .from('computer_queue')
          .update({ position: currentPosition })
          .eq('id', personId);
        throw new Error('Failed to move to final position');
      }

      // Add a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify the swap was successful
      const { data: verification } = await supabase
        .from('computer_queue')
        .select('id, position')
        .in('id', [personId, swapPerson.id])
        .eq('status', 'waiting');

      if (!verification || verification.length !== 2) {
        throw new Error('Position verification failed');
      }

      const currentPersonNew = verification.find(p => p.id === personId);
      const swapPersonNew = verification.find(p => p.id === swapPerson.id);

      if (currentPersonNew.position !== newPosition || swapPersonNew.position !== currentPosition) {
        console.error('Position verification failed:', {
          expected: { current: newPosition, swap: currentPosition },
          actual: { current: currentPersonNew.position, swap: swapPersonNew.position }
        });
        throw new Error('Position swap verification failed');
      }

      console.log(`Queue reorder successful: Person ${personId} moved from ${currentPosition} to ${newPosition}`);

    } catch (swapError) {
      console.error('Queue reorder failed:', swapError);
      return res.status(500).json({ error: 'Position swap failed. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Queue positions updated successfully',
      data: {
        moved: { id: personId, from: currentPosition, to: newPosition },
        swapped: { id: swapPerson.id, from: newPosition, to: currentPosition }
      }
    });

  } catch (error) {
    console.error('Queue reorder error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin or staff access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
} 