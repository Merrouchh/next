#!/usr/bin/env node

/**
 * Queue Monitor Script
 * 
 * This script monitors active user sessions and automatically removes users
 * from the queue when they are logged into a computer.
 * 
 * How it works:
 * 1. Fetches all active user sessions from the gaming system
 * 2. Fetches all users currently in the queue
 * 3. Cross-references to find users who are both in queue AND logged in
 * 4. Automatically removes those users from the queue
 * 
 * Run this script every 1-2 minutes as a cron job or keep it running continuously
 * 
 * Usage:
 * node scripts/queue-monitor.js
 * 
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - API_BASE_URL (Gizmo API)
 * - API_AUTH (Gizmo API credentials)
 */

// Load environment variables from .env files
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

// Configuration - try both naming conventions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const API_AUTH = process.env.API_AUTH;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !API_BASE_URL || !API_AUTH) {
  console.error('❌ Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  console.error('- API_BASE_URL:', !!API_BASE_URL);
  console.error('- API_AUTH:', !!API_AUTH);
  console.error('\n💡 Create a .env.local file in your project root with these variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('API_BASE_URL=your_gizmo_api_base_url');
  console.error('API_AUTH=your_gizmo_api_credentials');
  console.error('\n📝 You can find these values in:');
  console.error('- Supabase: Project Settings > API > Project URL & service_role key');
  console.error('- Gizmo: Your existing .env.local file or Gizmo API documentation');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Fetch active user sessions from Gizmo API
 */
async function fetchActiveUserSessions() {
  try {
    const response = await fetch(`${API_BASE_URL}/usersessions/active`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch active sessions: ${response.status}`);
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
}

/**
 * Fetch current queue from database
 */
async function fetchCurrentQueue() {
  try {
    const { data, error } = await supabase
      .from('computer_queue')
      .select('id, user_id, user_name, position')
      .eq('status', 'waiting')
      .order('position');

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching queue:', error);
    return [];
  }
}

/**
 * Get user's gizmo_id from the database by user_id
 */
async function getUserGizmoIds(queueEntries) {
  const userIds = queueEntries
    .filter(entry => entry.user_id)
    .map(entry => entry.user_id);
  
  if (userIds.length === 0) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, gizmo_id')
      .in('id', userIds)
      .not('gizmo_id', 'is', null);

    if (error) {
      throw error;
    }

    // Create a map of user_id -> gizmo_id
    const gizmoIdMap = {};
    data.forEach(user => {
      gizmoIdMap[user.id] = user.gizmo_id;
    });

    return gizmoIdMap;
  } catch (error) {
    console.error('Error fetching user gizmo IDs:', error);
    return {};
  }
}

/**
 * Get usernames for active sessions (for manual queue entries without website accounts)
 */
async function getActiveSessionUsernames(activeSessions) {
  const usernameMap = {};
  
  if (!activeSessions || activeSessions.length === 0) {
    return usernameMap;
  }

  // For each active session, try to get the username
  for (const session of activeSessions) {
    if (!session.userId) continue;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/${session.userId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(API_AUTH).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const username = data.result?.name || data.result?.username || data.result?.userName;
        
        if (username) {
          // Map: gizmo_id -> username
          usernameMap[session.userId] = username.toLowerCase();
          console.log(`🔗 Found username "${username}" for gizmo_id ${session.userId}`);
        }
      }
    } catch (error) {
      console.error(`Error fetching username for gizmo_id ${session.userId}:`, error);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return usernameMap;
}

/**
 * Remove a user from the queue
 */
async function removeUserFromQueue(queueEntryId, userName, reason) {
  try {
    const { error } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', queueEntryId);

    if (error) {
      throw error;
    }

    console.log(`✅ Removed ${userName} from queue (${reason})`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to remove ${userName} from queue:`, error);
    return false;
  }
}

/**
 * Check and handle automatic mode after queue changes
 */
async function handleAutomaticMode(currentQueueCount) {
  try {
    // Get current queue settings
    const { data: settings, error } = await supabase
      .from('queue_settings')
      .select('is_active, automatic_mode')
      .eq('id', 1)
      .single();

    if (error || !settings) {
      console.log('ℹ️ Could not fetch queue settings for automatic mode check');
      return;
    }

    if (!settings.automatic_mode) {
      console.log('ℹ️ Automatic mode is disabled, skipping auto-control');
      return;
    }

    const shouldBeActive = currentQueueCount > 0;
    
    if (shouldBeActive && !settings.is_active) {
      // Auto-start queue when people join
      console.log('🔄 Automatic mode: Starting queue (people in queue)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: true })
        .eq('id', 1);
        
      if (updateError) {
        console.error('❌ Failed to auto-start queue:', updateError);
      } else {
        console.log('✅ Auto-started queue system');
      }
    } else if (!shouldBeActive && settings.is_active) {
      // Auto-stop queue when empty
      console.log('🔄 Automatic mode: Stopping queue (queue is empty)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: false })
        .eq('id', 1);
        
      if (updateError) {
        console.error('❌ Failed to auto-stop queue:', updateError);
      } else {
        console.log('✅ Auto-stopped queue system');
      }
    }
  } catch (error) {
    console.error('❌ Error handling automatic mode:', error);
  }
}

/**
 * Main monitoring function
 */
async function monitorQueue() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Starting queue monitoring...`);

  try {
    // 1. Fetch active sessions and current queue in parallel
    const [activeSessions, queueEntries] = await Promise.all([
      fetchActiveUserSessions(),
      fetchCurrentQueue()
    ]);

    console.log(`📊 Found ${activeSessions.length} active sessions and ${queueEntries.length} people in queue`);

    if (queueEntries.length === 0) {
      console.log('✅ Queue is empty, checking automatic mode...');
      // Even if queue is empty, check if we need to auto-stop the queue system
      await handleAutomaticMode(0);
      return;
    }

    // 2. Get gizmo_ids for users in queue (users with website accounts)
    const userGizmoIds = await getUserGizmoIds(queueEntries);
    console.log(`🔗 Found ${Object.keys(userGizmoIds).length} queue users with linked website accounts`);

    // 3. Get usernames for active sessions (for manual entries without website accounts)
    const activeSessionUsernames = await getActiveSessionUsernames(activeSessions);
    console.log(`👤 Found ${Object.keys(activeSessionUsernames).length} active session usernames`);

    // 4. Find users who are both in queue AND logged in
    const usersToRemove = [];
    const activeUserIds = new Set(activeSessions.map(session => session.userId));

    queueEntries.forEach(queueEntry => {
      let shouldRemove = false;
      let matchedSession = null;
      let matchReason = '';

      // Method 1: Check if user has a gizmo_id and is currently logged in (website accounts)
      if (queueEntry.user_id) {
        const gizmoId = userGizmoIds[queueEntry.user_id];
        if (gizmoId && activeUserIds.has(gizmoId)) {
          matchedSession = activeSessions.find(s => s.userId === gizmoId);
          shouldRemove = true;
          matchReason = `website account logged into computer (Host ID: ${matchedSession.hostId})`;
        }
      }

      // Method 2: Check manual entries by username (no website account)
      if (!shouldRemove && !queueEntry.user_id && queueEntry.user_name) {
        const queueUsername = queueEntry.user_name.toLowerCase().trim();
        
        // Find if any active session has this username
        for (const [gizmoId, sessionUsername] of Object.entries(activeSessionUsernames)) {
          if (sessionUsername === queueUsername) {
            matchedSession = activeSessions.find(s => s.userId === parseInt(gizmoId));
            shouldRemove = true;
            matchReason = `manual entry "${queueEntry.user_name}" logged into computer (Host ID: ${matchedSession.hostId})`;
            break;
          }
        }
      }

      if (shouldRemove && matchedSession) {
        usersToRemove.push({
          queueEntry,
          session: matchedSession,
          reason: matchReason
        });
      }
    });

    console.log(`🎯 Found ${usersToRemove.length} users to remove from queue`);

    // 4. Remove users from queue
    if (usersToRemove.length > 0) {
      console.log('\n🚮 Removing users from queue:');
      
      for (const { queueEntry, reason } of usersToRemove) {
        await removeUserFromQueue(queueEntry.id, queueEntry.user_name, reason);
        
        // Small delay between removals to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate remaining queue count after removals
      const remainingQueueCount = queueEntries.length - usersToRemove.length;
      
      // Check automatic mode after changes
      await handleAutomaticMode(remainingQueueCount);

      console.log(`\n✨ Queue monitoring complete - removed ${usersToRemove.length} users`);
    } else {
      console.log('✅ No users need to be removed from queue');
      
      // Still check automatic mode in case queue state needs updating
      await handleAutomaticMode(queueEntries.length);
    }

  } catch (error) {
    console.error('❌ Error during queue monitoring:', error);
  }
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown() {
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Queue Monitor started');
  console.log('📋 This script will automatically remove users from the queue when they log into computers');
  
  setupGracefulShutdown();

  // Check if we should run once or continuously
  const runOnce = process.argv.includes('--once');
  
  if (runOnce) {
    console.log('🔄 Running in single-execution mode');
    await monitorQueue();
    console.log('✅ Single execution completed');
    process.exit(0);
  } else {
    console.log('🔄 Running in continuous mode (every 60 seconds)');
    console.log('💡 Use Ctrl+C to stop or add --once flag for single execution\n');
    
    // Run immediately
    await monitorQueue();
    
    // Then run every 60 seconds
    setInterval(async () => {
      await monitorQueue();
    }, 60000); // 60 seconds
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  monitorQueue,
  fetchActiveUserSessions,
  fetchCurrentQueue
}; 