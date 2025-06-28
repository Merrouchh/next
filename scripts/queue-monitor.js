#!/usr/bin/env node

/**
 * Queue Monitor Script with WhatsApp Notifications
 * 
 * This script monitors active user sessions and automatically removes users
 * from the queue when they are logged into a computer. It also provides
 * real-time WhatsApp notifications for queue position changes.
 * 
 * Features:
 * 1. Auto-removal: Removes users from queue when they log into computers
 * 2. WhatsApp notifications: Sends position updates and "your turn" messages
 * 3. Real-time monitoring: Uses Supabase subscriptions for instant updates
 * 4. Automatic mode: Auto-starts/stops queue system based on occupancy
 * 
 * Execution Modes:
 * 
 * 1. Periodic Mode (default):
 *    node scripts/queue-monitor.js
 *    - Runs auto-removal every 60 seconds
 *    - Basic WhatsApp notifications on position changes
 * 
 * 2. Real-time Mode (recommended):
 *    node scripts/queue-monitor.js --realtime
 *    - Auto-removal every 30 seconds (more responsive)
 *    - Real-time WhatsApp notifications via Supabase subscriptions
 *    - Instant position updates when queue changes
 * 
 * 3. Single Execution:
 *    node scripts/queue-monitor.js --once
 *    - Runs once and exits (good for cron jobs)
 * 
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - API_BASE_URL (Gizmo API)
 * - API_AUTH (Gizmo API credentials)
 * - INFOBIP_API_KEY (optional - for WhatsApp notifications)
 * 
 * WhatsApp Templates Required (in Infobip dashboard):
 * - client_queue: "👋 Hi {{1}}, here's your current queue status: 📍 Position: [#{{2}} in queue]"
 * - your_turn_has_come: "🎮 {{1}}, your turn has come! ✅ We are logging you in now..."
 */

// Load environment variables from .env files
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

// Use built-in fetch (Node.js 18+) or import node-fetch
async function getFetch() {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch;
  }
  const nodeFetch = await import('node-fetch');
  return nodeFetch.default;
}

// Configuration - try both naming conventions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const API_AUTH = process.env.API_AUTH;
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY;

// Validate required environment variables
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

// Optional WhatsApp notifications
if (!INFOBIP_API_KEY) {
  console.log('⚠️ INFOBIP_API_KEY not found - WhatsApp notifications will be disabled');
} else {
  console.log('📱 WhatsApp notifications enabled via Infobip');
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Queue state tracking for WhatsApp notifications
let queueSnapshot = new Map();
let updateTimeout = null;
let recentNotifications = new Map(); // Track recent notifications to prevent duplicates
let processingBatchId = null; // Prevent duplicate batch processing

/**
 * Send WhatsApp notification using Infobip templates
 */
async function sendWhatsAppQueueNotification(phoneNumber, templateType, params = {}) {
  if (!INFOBIP_API_KEY) {
    console.log('📱 WhatsApp notifications disabled (no API key)');
    return { success: false, reason: 'no_api_key' };
  }

  if (!phoneNumber) {
    console.log('📱 No phone number provided, skipping WhatsApp notification');
    return { success: false, reason: 'no_phone' };
  }

  try {
    // Format phone number (remove + if present for Infobip)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
    
    let payload;
    
    switch (templateType) {
      case 'queue_joined':
        // Template: client_queue - has {{1}} = userName, {{2}} = position
        payload = {
          messages: [
            {
              from: "447860098167",
              to: formattedPhone,
              content: {
                templateName: "client_queue",
                templateData: {
                  body: {
                    placeholders: [
                      params.userName || "there", // {{1}} - user name
                      params.position ? params.position.toString() : "1" // {{2}} - position number
                    ]
                  }
                },
                language: "en"
              }
            }
          ]
        };
        break;
        
      case 'your_turn':
        // Template: your_turn_has_come - has {{1}} = userName, static phone button
        const userName = params.userName || "there";
        
        payload = {
          messages: [
            {
              from: "447860098167",
              to: formattedPhone,
              content: {
                templateName: "your_turn_has_come",
                templateData: {
                  body: {
                    placeholders: [userName] // {{1}} - user name
                  }
                },
                language: "en"
              }
            }
          ]
        };
        break;
        
      default:
        throw new Error(`Unknown template type: ${templateType}`);
    }

    console.log(`📱 Sending WhatsApp ${templateType} notification to ${formattedPhone}`);

    // Call Infobip API
    const fetch = await getFetch();
    const response = await fetch('https://m3y3xw.api.infobip.com/whatsapp/1/message/template', {
      method: 'POST',
      headers: {
        'Authorization': `App ${INFOBIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Error from Infobip API:', JSON.stringify(responseData, null, 2));
      throw new Error(`Failed to send WhatsApp message: ${responseData.error || responseData.message || 'Unknown error'}`);
    }

    console.log(`✅ WhatsApp ${templateType} notification sent successfully to ${formattedPhone}`);
    return { 
      success: true, 
      messageId: responseData.messages?.[0]?.messageId,
      response: responseData 
    };

  } catch (error) {
    console.error(`❌ Error sending WhatsApp ${templateType} notification:`, error);
    return { 
      success: false, 
      error: error.message,
      reason: 'send_failed' 
    };
  }
}

/**
 * Notify user when they join the queue
 */
async function notifyQueueJoined(phoneNumber, position, computerType = 'any', userName = 'there') {
  return await sendWhatsAppQueueNotification(phoneNumber, 'queue_joined', {
    userName,
    position,
    computerType
  });
}

/**
 * Notify user when it's their turn
 */
async function notifyYourTurn(phoneNumber, userName, computerType = 'any') {
  return await sendWhatsAppQueueNotification(phoneNumber, 'your_turn', {
    userName,
    computerType
  });
}

/**
 * Enhance queue data with phone numbers from users table
 */
async function enhanceQueueWithPhoneNumbers(queueData) {
  if (!queueData || queueData.length === 0) {
    return queueData;
  }

  // Get user IDs that have no phone_number but have user_id
  const userIdsToFetch = queueData
    .filter(person => !person.phone_number && person.user_id)
    .map(person => person.user_id);

  if (userIdsToFetch.length === 0) {
    return queueData; // No need to fetch additional phone numbers
  }

  try {
    // Fetch phone numbers from users table
    const { data: userPhones, error } = await supabase
      .from('users')
      .select('id, phone')
      .in('id', userIdsToFetch);

    if (error) {
      console.error('❌ Error fetching user phone numbers:', error);
      return queueData; // Return original data if fetch fails
    }

    // Create a map of user_id -> phone
    const phoneMap = {};
    if (userPhones) {
      userPhones.forEach(user => {
        if (user.phone) {
          phoneMap[user.id] = user.phone;
        }
      });
    }

    // Enhance queue data with phone numbers
    return queueData.map(person => ({
      ...person,
      user_phone: phoneMap[person.user_id] || null
    }));

  } catch (error) {
    console.error('❌ Error in enhanceQueueWithPhoneNumbers:', error);
    return queueData; // Return original data if enhancement fails
  }
}

/**
 * Get the effective phone number from multiple sources
 */
function getEffectivePhoneNumber(person) {
  // Priority: direct phone_number field first, then user_phone field
  if (person.phone_number) {
    return person.phone_number;
  }
  
  if (person.user_phone) {
    return person.user_phone;
  }
  
  return null;
}

/**
 * Check if we recently sent a notification to prevent duplicates
 */
function wasRecentlySent(userId, newPosition, userName = '') {
  const notificationKey = `${userId}_${newPosition}`;
  const lastSent = recentNotifications.get(notificationKey);
  const now = Date.now();
  
  // Consider "recent" as within the last 15 seconds (increased from 10)
  if (lastSent && (now - lastSent) < 15000) {
    console.log(`🚫 Duplicate notification blocked for ${userName} (position ${newPosition}) - sent ${Math.round((now - lastSent)/1000)}s ago`);
    return true;
  }
  
  // Mark as sent
  recentNotifications.set(notificationKey, now);
  console.log(`✅ Notification allowed for ${userName} (position ${newPosition})`);
  
  // Clean up old entries (older than 60 seconds)
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 60000) {
      recentNotifications.delete(key);
    }
  }
  
  return false;
}

/**
 * Update queue snapshot and detect position changes for WhatsApp notifications
 */
async function updateQueueSnapshot() {
  console.log(`\n🔄 ===== updateQueueSnapshot() START =====`);
  console.log(`🕐 Timestamp: ${new Date().toLocaleTimeString()}`);
  
  if (!INFOBIP_API_KEY) {
    console.log(`❌ INFOBIP_API_KEY not found - skipping WhatsApp notifications`);
    return; // Skip if WhatsApp is disabled
  }

  // Prevent processing the same batch multiple times
  const currentBatchId = Date.now();
  if (processingBatchId && (currentBatchId - processingBatchId) < 2000) {
    console.log(`📱 Skipping duplicate batch processing (${Math.round((currentBatchId - processingBatchId)/1000)}s ago)`);
    return;
  }
  processingBatchId = currentBatchId;
  console.log(`✅ Processing batch ID: ${currentBatchId}`);

  try {
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, user_id')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error fetching current queue for notifications:', error);
      return;
    }

    // Enhance queue data with phone numbers from users table
    const enhancedQueue = await enhanceQueueWithPhoneNumbers(currentQueue);

    console.log(`\n📊 CURRENT STATE COMPARISON:`);
    console.log(`   📋 Current queue from DB: ${enhancedQueue.length} people`);
    console.log(`   💾 Snapshot in memory: ${queueSnapshot.size} people`);
    console.log(`   📋 Current queue details:`);
    enhancedQueue.forEach(p => {
      const phoneNumber = getEffectivePhoneNumber(p);
      console.log(`      - ID: ${p.id}, Name: ${p.user_name}, Position: ${p.position}, Phone: ${phoneNumber || 'none'}`);
    });
    console.log(`   💾 Snapshot details:`);
    Array.from(queueSnapshot.entries()).forEach(([id, person]) => {
      const phoneNumber = getEffectivePhoneNumber(person);
      console.log(`      - ID: ${id}, Name: ${person.user_name}, Position: ${person.position}, Phone: ${phoneNumber || 'none'}`);
    });

    const newSnapshot = new Map();
    const positionChanges = [];
    const newJoiners = [];
    
    console.log(`\n🔍 ANALYZING CHANGES:`);
    console.log(`   Looking for new joiners and position changes...`);

    // Build new snapshot and detect changes
    enhancedQueue.forEach((person, index) => {
      console.log(`\n   👤 Processing person ${index + 1}/${enhancedQueue.length}:`);
      console.log(`      ID: ${person.id}, Name: ${person.user_name}, Position: ${person.position}`);
      
      newSnapshot.set(person.id, person);
      
      const oldPerson = queueSnapshot.get(person.id);
      console.log(`      Old person in snapshot: ${oldPerson ? 'EXISTS' : 'NOT FOUND'}`);
      
      if (!oldPerson) {
        // NEW person joining the queue
        console.log(`      ✅ RESULT: NEW JOINER detected!`);
        const phoneNumber = getEffectivePhoneNumber(person);
        console.log(`🆕 DETECTED NEW JOINER - ID: ${person.id}, Name: ${person.user_name}, Position: ${person.position}, Phone: ${phoneNumber || 'none'}`);
        newJoiners.push(person);
      } else if (oldPerson.position !== person.position) {
        // EXISTING person with position change
        console.log(`      ✅ RESULT: POSITION CHANGE detected! (${oldPerson.position} → ${person.position})`);
        console.log(`📍 DETECTED POSITION CHANGE - ID: ${person.id}, Name: ${person.user_name}, ${oldPerson.position} → ${person.position}`);
        positionChanges.push({
          person,
          oldPosition: oldPerson.position,
          newPosition: person.position
        });
      } else {
        console.log(`      ➖ RESULT: No change (position ${person.position})`);
      }
    });

    // Send notifications to NEW people joining the queue
    for (const person of newJoiners) {
      const effectivePhone = getEffectivePhoneNumber(person);
      
      if (!effectivePhone) {
        console.log(`📱 ${person.user_name} joined queue at position ${person.position} but no phone number`);
        continue;
      }

      // Check if we recently sent a notification for this person/position
      if (wasRecentlySent(person.id, person.position, person.user_name)) {
        console.log(`📱 ${person.user_name} joined queue at position ${person.position} - skipping (duplicate)`);
        continue;
      }

      try {
        let result;
        if (person.position === 1) {
          console.log(`📱 ${person.user_name} joined queue at position 1 - sending "your turn" notification`);
          result = await notifyYourTurn(effectivePhone, person.user_name, person.computer_type);
        } else {
          console.log(`📱 ${person.user_name} joined queue at position ${person.position} - sending "queue joined" notification`);
          result = await notifyQueueJoined(effectivePhone, person.position, person.computer_type, person.user_name);
        }
        
        if (result.success) {
          console.log(`✅ Welcome notification sent to ${person.user_name}: ${result.messageId}`);
        } else {
          console.log(`❌ Failed to welcome ${person.user_name}: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Error welcoming ${person.user_name}:`, error);
      }
    }

    // Send notifications for position changes (with deduplication)
    for (const change of positionChanges) {
      const { person, oldPosition, newPosition } = change;
      const effectivePhone = getEffectivePhoneNumber(person);
      
      if (!effectivePhone) {
        console.log(`📱 ${person.user_name} position changed ${oldPosition}→${newPosition} but no phone number`);
        continue;
      }

      // Check if we recently sent a notification for this person/position
      if (wasRecentlySent(person.id, newPosition, person.user_name)) {
        console.log(`📱 ${person.user_name} position changed ${oldPosition}→${newPosition} - skipping (duplicate)`);
        continue;
      }

      try {
        let result;
        if (newPosition === 1) {
          console.log(`📱 ${person.user_name} moved to position 1 - sending "your turn" notification`);
          result = await notifyYourTurn(effectivePhone, person.user_name, person.computer_type);
        } else {
          console.log(`📱 ${person.user_name} position changed ${oldPosition}→${newPosition} - sending queue update`);
          result = await notifyQueueJoined(effectivePhone, newPosition, person.computer_type, person.user_name);
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
    console.log(`\n💾 UPDATING SNAPSHOT:`);
    console.log(`   Old snapshot size: ${queueSnapshot.size}`);
    queueSnapshot = newSnapshot;
    console.log(`   New snapshot size: ${queueSnapshot.size}`);
    
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`   🆕 New joiners: ${newJoiners.length}`);
    console.log(`   📍 Position changes: ${positionChanges.length}`);
    
    if (newJoiners.length > 0) {
      console.log(`   📝 New joiners list:`);
      newJoiners.forEach(person => {
        const phoneNumber = getEffectivePhoneNumber(person);
        console.log(`      - ${person.user_name} (ID: ${person.id}, Position: ${person.position}, Phone: ${phoneNumber || 'none'})`);
      });
    }
    
    if (positionChanges.length > 0) {
      console.log(`   📝 Position changes list:`);
      positionChanges.forEach(change => {
        console.log(`      - ${change.person.user_name} (${change.oldPosition} → ${change.newPosition})`);
      });
    }
    
    if (newJoiners.length > 0 || positionChanges.length > 0) {
      console.log(`📋 Processed ${newJoiners.length} new joiners and ${positionChanges.length} position changes for notifications`);
    } else {
      console.log(`📋 No changes detected - no notifications needed`);
    }
    
    console.log(`🔄 ===== updateQueueSnapshot() END =====\n`);

  } catch (error) {
    console.error('❌ Error updating queue snapshot for notifications:', error);
    console.log(`🔄 ===== updateQueueSnapshot() END (ERROR) =====\n`);
  }
}

/**
 * Initialize queue snapshot for WhatsApp notifications
 */
async function initializeQueueSnapshot() {
  if (!INFOBIP_API_KEY) {
    return; // Skip if WhatsApp is disabled
  }

  try {
    console.log('🚀 Initializing queue snapshot for WhatsApp notifications...');
    
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, user_id')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      console.error('❌ Error initializing queue snapshot:', error);
      return;
    }

    // Enhance queue data with phone numbers from users table
    const enhancedQueue = await enhanceQueueWithPhoneNumbers(currentQueue);

    queueSnapshot = new Map();
    enhancedQueue.forEach(person => {
      queueSnapshot.set(person.id, person);
    });

    console.log(`✅ Initialized WhatsApp monitoring with ${queueSnapshot.size} people in queue`);
  } catch (error) {
    console.error('❌ Error in initializeQueueSnapshot:', error);
  }
}

/**
 * Fetch active user sessions from Gizmo API
 */
async function fetchActiveUserSessions() {
  try {
    const fetch = await getFetch();
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
      const fetch = await getFetch();
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
      
      // Update WhatsApp notifications for position changes after removals
      await updateQueueSnapshot();
      
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
 * Start real-time queue monitoring with Supabase subscriptions
 */
async function startRealTimeMonitoring() {
  console.log('📡 Starting real-time queue monitoring...');
  
  // Initialize WhatsApp queue snapshot
  await initializeQueueSnapshot();
  
  // Set up real-time subscription to monitor queue changes with debouncing
  const subscription = supabase
    .channel('queue-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'computer_queue'
    }, async (payload) => {
      console.log(`\n🔔 ===== REAL-TIME EVENT RECEIVED =====`);
      console.log(`📡 Event Type: ${payload.eventType}`);
      console.log(`🕐 Event Time: ${new Date().toLocaleTimeString()}`);
      console.log(`📄 Payload Details:`);
      console.log(`   Schema: ${payload.schema}`);
      console.log(`   Table: ${payload.table}`);
      if (payload.new) {
        console.log(`   New Record: ID ${payload.new.id}, User: ${payload.new.user_name}, Position: ${payload.new.position}`);
      }
      if (payload.old) {
        console.log(`   Old Record: ID ${payload.old.id}, User: ${payload.old.user_name}, Position: ${payload.old.position}`);
      }
      console.log(`🔔 ===== REAL-TIME EVENT END =====\n`);
      
      // Debounce rapid changes - clear existing timeout and set new one
      if (updateTimeout) {
        console.log(`⏱️ Clearing existing timeout - batching multiple events`);
        clearTimeout(updateTimeout);
      }
      
      updateTimeout = setTimeout(async () => {
        console.log('📱 Processing batched queue changes for notifications...');
        await updateQueueSnapshot();
        updateTimeout = null;
      }, 3000); // Wait 3 seconds for all related changes to complete
    })
    .subscribe();

  console.log('✅ Real-time WhatsApp notifications enabled');
  return subscription;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Queue Monitor started');
  console.log('📋 This script will automatically remove users from the queue when they log into computers');
  
  setupGracefulShutdown();

  // Check execution mode
  const runOnce = process.argv.includes('--once');
  const realTime = process.argv.includes('--realtime');
  
  if (runOnce) {
    console.log('🔄 Running in single-execution mode');
    await monitorQueue();
    console.log('✅ Single execution completed');
    process.exit(0);
  } else if (realTime) {
    console.log('🔄 Running in real-time mode with WhatsApp notifications');
    console.log('💡 Use Ctrl+C to stop\n');
    
    // Start real-time monitoring for WhatsApp notifications
    const subscription = await startRealTimeMonitoring();
    
    // Run user removal check immediately and then every 30 seconds
    await monitorQueue();
    const interval = setInterval(async () => {
      await monitorQueue();
    }, 30000); // 30 seconds for more responsive auto-removal
    
    // Cleanup on shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down real-time monitoring...');
      clearInterval(interval);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      subscription.unsubscribe();
      console.log('✅ Stopped gracefully');
      process.exit(0);
    });
    
    // Keep the process alive
    console.log('📋 Features enabled:');
    console.log('  • Auto-removal of logged-in users (every 30s)');
    console.log('  • Real-time WhatsApp position notifications');
    console.log('  • Queue automatic mode management');
    
  } else {
    console.log('🔄 Running in periodic mode (every 60 seconds)');
    console.log('💡 Use Ctrl+C to stop, --once for single execution, or --realtime for WhatsApp notifications\n');
    
    // Initialize WhatsApp monitoring for periodic mode too
    await initializeQueueSnapshot();
    
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