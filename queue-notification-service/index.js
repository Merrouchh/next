require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { notifyQueueJoined, notifyYourTurn } = require('./whatsapp');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gizmo API configuration
const GIZMO_API_BASE = process.env.GIZMO_API_BASE_URL;
const GIZMO_API_AUTH = process.env.GIZMO_API_AUTH;

// Service state
let isRunning = false;
let queueSnapshot = new Map(); // Track current queue state

/**
 * Check if a user is currently logged into any computer via Gizmo API
 */
async function isUserLoggedIn(gizmoId) {
  if (!gizmoId || !GIZMO_API_BASE || !GIZMO_API_AUTH) {
    return false;
  }

  try {
    const response = await fetch(`${GIZMO_API_BASE}/usersessions/active`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(GIZMO_API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch active sessions: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const activeSessions = data.result || [];
    
    // Check if this user has an active session
    const userSession = activeSessions.find(session => session.userId === parseInt(gizmoId));
    return !!userSession;
    
  } catch (error) {
    console.error(`❌ Error checking login status for user ${gizmoId}:`, error);
    return false;
  }
}

/**
 * Auto-remove logged-in users from queue
 */
async function checkAndRemoveLoggedInUsers() {
  try {
    console.log('🔍 Checking for logged-in users in queue...');
    
    // Get all users in queue who have a user_id (linked account)
    const { data: queueUsers, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, user_id, position, phone_number')
      .eq('status', 'waiting')
      .not('user_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching queue users:', error);
      return;
    }

    if (!queueUsers || queueUsers.length === 0) {
      console.log('✅ No users with linked accounts in queue');
      return;
    }

    // Check each user's login status
    const removalPromises = queueUsers.map(async (user) => {
      try {
        // Get user's gizmo_id from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('gizmo_id')
          .eq('id', user.user_id)
          .single();

        if (userError || !userData?.gizmo_id) {
          return null; // Skip if no gizmo_id
        }

        const loggedIn = await isUserLoggedIn(userData.gizmo_id);
        
        if (loggedIn) {
          console.log(`🎮 ${user.user_name} is logged in, removing from queue (position ${user.position})`);
          
          // Remove from queue
          const { error: removeError } = await supabase
            .from('computer_queue')
            .delete()
            .eq('id', user.id);

          if (removeError) {
            console.error(`❌ Error removing ${user.user_name} from queue:`, removeError);
            return null;
          }

          return {
            removed: true,
            user: user.user_name,
            position: user.position
          };
        }

        return null;
      } catch (error) {
        console.error(`❌ Error checking user ${user.user_name}:`, error);
        return null;
      }
    });

    const results = await Promise.all(removalPromises);
    const removedUsers = results.filter(result => result && result.removed);

    if (removedUsers.length > 0) {
      console.log(`✅ Removed ${removedUsers.length} logged-in users from queue`);
      // The queue positions will be automatically reordered by database triggers
    }

  } catch (error) {
    console.error('❌ Error in checkAndRemoveLoggedInUsers:', error);
  }
}

/**
 * Update queue snapshot and detect position changes
 */
async function updateQueueSnapshot() {
  try {
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, notes')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error fetching current queue:', error);
      return;
    }

    const newSnapshot = new Map();
    const positionChanges = [];

    // Build new snapshot and detect changes
    currentQueue.forEach(person => {
      newSnapshot.set(person.id, person);
      
      const oldPerson = queueSnapshot.get(person.id);
      if (oldPerson && oldPerson.position !== person.position) {
        positionChanges.push({
          person,
          oldPosition: oldPerson.position,
          newPosition: person.position
        });
      }
    });

    // Send notifications for position changes
    for (const change of positionChanges) {
      const { person, oldPosition, newPosition } = change;

      const hasOptedOut = typeof person.notes === 'string' && person.notes.includes('[no_whatsapp]');
      if (hasOptedOut) {
        console.log(`📵 ${person.user_name} opted out of WhatsApp notifications`);
        continue;
      }
      
      if (!person.phone_number) {
        console.log(`📱 ${person.user_name} position changed ${oldPosition}→${newPosition} but no phone number`);
        continue;
      }

      try {
        let result;
        if (newPosition === 1) {
          console.log(`📱 ${person.user_name} moved to position 1 - sending "your turn" notification`);
          result = await notifyYourTurn(person.phone_number, person.user_name, person.computer_type);
        } else {
          console.log(`📱 ${person.user_name} position changed ${oldPosition}→${newPosition} - sending queue update`);
          result = await notifyQueueJoined(person.phone_number, newPosition, person.computer_type, person.user_name);
        }
        
        if (result.success) {
          console.log(`✅ Notification sent to ${person.user_name}: ${result.messageId}`);
        } else {
          console.log(`❌ Failed to notify ${person.user_name}: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Error notifying ${person.user_name}:`, error);
      }
    }

    // Update snapshot
    queueSnapshot = newSnapshot;
    
    if (positionChanges.length > 0) {
      console.log(`📋 Processed ${positionChanges.length} position changes`);
    }

  } catch (error) {
    console.error('❌ Error updating queue snapshot:', error);
  }
}

/**
 * Initialize queue snapshot on startup
 */
async function initializeQueueSnapshot() {
  try {
    console.log('🚀 Initializing queue snapshot...');
    
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, notes')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error initializing queue snapshot:', error);
      return;
    }

    queueSnapshot = new Map();
    currentQueue.forEach(person => {
      queueSnapshot.set(person.id, person);
    });

    console.log(`✅ Initialized with ${queueSnapshot.size} people in queue`);
  } catch (error) {
    console.error('❌ Error in initializeQueueSnapshot:', error);
  }
}

/**
 * Start the queue monitoring service
 */
async function startService() {
  if (isRunning) {
    console.log('⚠️ Service is already running');
    return;
  }

  console.log('🚀 Starting Queue Notification Service...');
  console.log(`📱 WhatsApp API: ${process.env.INFOBIP_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`🎮 Gizmo API: ${GIZMO_API_BASE ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📊 Supabase: ${process.env.SUPABASE_URL ? 'Configured' : 'NOT CONFIGURED'}`);

  isRunning = true;

  // Initialize queue snapshot
  await initializeQueueSnapshot();

  // Set up real-time subscription to monitor queue changes
  const subscription = supabase
    .channel('queue-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'computer_queue'
    }, async (payload) => {
      console.log(`📡 Queue change detected: ${payload.eventType}`);
      
      // Small delay to ensure database consistency
      setTimeout(async () => {
        await updateQueueSnapshot();
      }, 500);
    })
    .subscribe();

  console.log('📡 Real-time queue monitoring started');

  // Periodic check for logged-in users (every 30 seconds)
  const loginCheckInterval = setInterval(async () => {
    await checkAndRemoveLoggedInUsers();
  }, 30000);

  // Health check interval (every 5 minutes)
  const healthCheckInterval = setInterval(() => {
    console.log(`💓 Service running - monitoring ${queueSnapshot.size} people in queue`);
  }, 300000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down service...');
    isRunning = false;
    clearInterval(loginCheckInterval);
    clearInterval(healthCheckInterval);
    subscription.unsubscribe();
    console.log('✅ Service stopped gracefully');
    process.exit(0);
  });

  console.log('✅ Queue Notification Service is running!');
  console.log('📋 Features enabled:');
  console.log('  • Real-time queue monitoring');
  console.log('  • WhatsApp position notifications');
  console.log('  • Auto-removal of logged-in users');
  console.log('  • Your turn notifications');
  console.log('\n🔍 Press Ctrl+C to stop the service\n');
}

// Start the service
startService().catch(error => {
  console.error('❌ Failed to start service:', error);
  process.exit(1);
}); 