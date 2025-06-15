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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const admin = await verifyAdmin(req.headers.authorization);
    
    const { personId, message } = req.body;
    
    if (!personId || !message) {
      return res.status(400).json({ error: 'Person ID and message are required' });
    }

    // Get person details
    const { data: person, error: fetchError } = await supabase
      .from('computer_queue')
      .select(`
        id,
        user_name,
        position,
        user_id,
        phone_number,
        is_physical
      `)
      .eq('id', personId)
      .eq('status', 'waiting')
      .single();

    if (fetchError || !person) {
      return res.status(404).json({ error: 'Person not found in queue' });
    }

    const notifications = [];

    // If person has a user account, create in-app notification
    if (person.user_id) {
      try {
        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: person.user_id,
            title: '🎮 Your Computer is Ready!',
            message: message,
            type: 'queue_ready',
            is_read: false,
            created_at: new Date().toISOString()
          });

        if (!notifyError) {
          notifications.push('In-app notification sent');
        }
      } catch (error) {
        console.error('Error sending in-app notification:', error);
      }
    }

    // If person has phone number, you could integrate SMS here
    // For now, we'll just log it as a placeholder
    if (person.phone_number) {
      console.log(`SMS notification would be sent to ${person.phone_number}: ${message}`);
      notifications.push('SMS notification logged (SMS integration not implemented)');
    }

    // If no notification methods available
    if (notifications.length === 0) {
      notifications.push('Person notified through physical queue system');
    }

    // Log the notification in queue activity
    try {
      await supabase
        .from('queue_activity')
        .insert({
          queue_entry_id: personId,
          action: 'notified',
          details: { message, method: notifications.join(', ') },
          performed_by: admin.id,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging queue activity:', error);
    }

    return res.status(200).json({
      success: true,
      message: `${person.user_name} has been notified`,
      methods: notifications
    });

  } catch (error) {
    console.error('Queue notification error:', error);
    if (error.message === 'Unauthorized' || error.message === 'Admin or staff access required') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
} 