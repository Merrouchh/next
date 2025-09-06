#!/usr/bin/env node

/**
 * SIMPLE & RELIABLE Queue Monitor
 * 
 * This is a simplified version focused on reliability over complexity.
 * Perfect for job-critical environments where things must work consistently.
 * 
 * Features:
 * - Simple polling every 10 seconds (no complex real-time subscriptions)
 * - Database-backed state (no memory snapshots that can get corrupted)
 * - Auto-removal of logged-in users
 * - Reliable WhatsApp notifications
 * - Easy to debug and maintain
 * 
 * Usage:
 * node scripts/simple-queue-monitor.js
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ===== SIMPLE LOGGING =====
const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'simple-queue-monitor-errors.log');
const INFO_LOG = path.join(LOG_DIR, 'simple-queue-monitor-info.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Simple logger
class Logger {
  static writeLog(level, message, logPath) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] ${message}\n`;
      fs.appendFileSync(logPath, logEntry);
    } catch (error) {
      console.error('Logging failed:', error.message);
    }
  }

  static error(message, error = null) {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    this.writeLog('ERROR', fullMessage, ERROR_LOG);
    console.error(`❌ ${fullMessage}`);
  }

  static info(message) {
    this.writeLog('INFO', message, INFO_LOG);
    console.log(`ℹ️ ${message}`);
  }

  static success(message) {
    this.writeLog('SUCCESS', message, INFO_LOG);
    console.log(`✅ ${message}`);
  }
}

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const API_AUTH = process.env.API_AUTH;
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !API_BASE_URL || !API_AUTH) {
  Logger.error('Missing required environment variables - check .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Simple state tracking
let isProcessing = false;
let whatsappCalls = 0;
let whatsappResetTime = 0;

// Get fetch function
async function getFetch() {
  const baseFetch = (typeof globalThis.fetch !== 'undefined') 
    ? globalThis.fetch 
    : (await import('node-fetch')).default;
  
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await baseFetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };
}

/**
 * Send WhatsApp notification - simplified version
 */
async function sendWhatsAppNotification(phoneNumber, userName, position, isYourTurn = false) {
  if (!INFOBIP_API_KEY) {
    Logger.info(`WhatsApp disabled for ${userName} - no API key`);
    return { success: false, reason: 'no_api_key' };
  }

  if (!phoneNumber) {
    Logger.info(`No phone number for ${userName}`);
    return { success: false, reason: 'no_phone' };
  }

  // Simple rate limiting
  const now = Date.now();
  if (now > whatsappResetTime) {
    whatsappCalls = 0;
    whatsappResetTime = now + 60000; // Reset every minute
  }

  if (whatsappCalls >= 10) {
    Logger.info(`WhatsApp rate limit reached for ${userName}`);
    return { success: false, reason: 'rate_limited' };
  }

  try {
    whatsappCalls++;
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber.substring(1) : phoneNumber;
    const templateType = isYourTurn ? 'your_turn_has_come' : 'client_queue';
    
    let payload = {
      messages: [
        {
          from: "447860098167",
          to: formattedPhone,
          content: {
            templateName: templateType,
            templateData: {
              body: {
                placeholders: isYourTurn ? [userName] : [userName, position.toString()]
              }
            },
            language: "en"
          }
        }
      ]
    };

    Logger.info(`📱 Sending ${templateType} to ${userName} (position ${position})`);

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

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    Logger.success(`WhatsApp sent to ${userName}`);
    return { success: true };

  } catch (error) {
    Logger.error(`WhatsApp failed for ${userName}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get active user sessions from Gizmo API
 */
async function fetchActiveSessions() {
  try {
    const fetch = await getFetch();
    const response = await fetch(`${API_BASE_URL}/usersessions/active`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    Logger.error('Error fetching active sessions', error);
    return [];
  }
}

/**
 * Get current queue
 */
async function fetchQueue() {
  try {
    const { data, error } = await supabase
      .from('computer_queue')
      .select(`
        id, 
        user_name, 
        phone_number, 
        position, 
        user_id,
        created_at,
        last_notified_at,
        last_notified_position,
        periodic_notification_count
      `)
      .eq('status', 'waiting')
      .order('position');

    if (error) throw error;
    return data || [];
  } catch (error) {
    Logger.error('Error fetching queue', error);
    return [];
  }
}

/**
 * Get gizmo IDs for users
 */
async function getUserGizmoIds(userIds) {
  if (userIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, gizmo_id, phone')
      .in('id', userIds);

    if (error) throw error;

    const result = {};
    data.forEach(user => {
      result[user.id] = {
        gizmo_id: user.gizmo_id,
        phone: user.phone
      };
    });

    return result;
  } catch (error) {
    Logger.error('Error fetching user data', error);
    return {};
  }
}

/**
 * Remove user from queue
 */
async function removeFromQueue(queueId, userName, reason) {
  try {
    const { error } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', queueId);

    if (error) throw error;

    Logger.success(`Removed ${userName} from queue (${reason})`);
    return true;
  } catch (error) {
    Logger.error(`Failed to remove ${userName}`, error);
    return false;
  }
}

/**
 * Update notification status
 */
async function updateNotificationStatus(queueId, currentPosition) {
  try {
    const { error } = await supabase
      .from('computer_queue')
      .update({ 
        last_notified_at: new Date().toISOString(),
        last_notified_position: currentPosition
      })
      .eq('id', queueId);

    if (error) throw error;
  } catch (error) {
    Logger.error('Error updating notification status', error);
  }
}

/**
 * Handle automatic mode - turn queue on/off based on queue count
 */
async function handleAutomaticMode(queueCount) {
  try {
    // Get current queue settings
    const { data: settings, error } = await supabase
      .from('queue_settings')
      .select('is_active, automatic_mode')
      .eq('id', 1)
      .single();

    if (error || !settings) {
      Logger.info('Could not fetch queue settings for automatic mode check');
      return;
    }

    if (!settings.automatic_mode) {
      Logger.debug('Automatic mode is disabled, skipping auto-control');
      return;
    }

    const shouldBeActive = queueCount > 0;
    
    Logger.info(`🔧 Auto-control check: Queue count=${queueCount}, Currently active=${settings.is_active}, Automatic mode=${settings.automatic_mode}`);

    if (shouldBeActive && !settings.is_active) {
      // Auto-start queue when people join
      Logger.info('🚀 Auto-control: Starting queue system (people joined)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: true })
        .eq('id', 1);
        
      if (updateError) {
        Logger.error('❌ Auto-control: Failed to start queue', updateError);
      } else {
        Logger.success('✅ Auto-control: Queue system started');
      }
    } else if (!shouldBeActive && settings.is_active) {
      // Auto-stop queue when empty
      Logger.info('🛑 Auto-control: Stopping queue system (queue empty)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: false })
        .eq('id', 1);
        
      if (updateError) {
        Logger.error('❌ Auto-control: Failed to stop queue', updateError);
      } else {
        Logger.success('✅ Auto-control: Queue system stopped');
      }
    } else {
      Logger.debug('✅ Auto-control: Queue state is correct, no changes needed');
    }
  } catch (error) {
    Logger.error('Error handling automatic mode', error);
  }
}

/**
 * Debug function to check queue status and settings
 */
async function debugQueueStatus() {
  try {
    Logger.info('🔍 DEBUG: Checking queue status and settings...');
    
    // Get queue settings
    const { data: settings, error: settingsError } = await supabase
      .from('queue_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError) {
      Logger.error('❌ DEBUG: Could not fetch queue settings', settingsError);
      return;
    }

    Logger.info(`📊 DEBUG: Queue Settings - Active: ${settings.is_active}, Automatic Mode: ${settings.automatic_mode}`);

    // Get current queue
    const { data: queueEntries, error: queueError } = await supabase
      .from('computer_queue')
      .select('id, user_name, position, status, periodic_notification_count')
      .eq('status', 'waiting')
      .order('position');

    if (queueError) {
      Logger.error('❌ DEBUG: Could not fetch queue entries', queueError);
      return;
    }

    Logger.info(`📋 DEBUG: Queue Entries - Count: ${queueEntries.length}`);
    if (queueEntries.length > 0) {
      queueEntries.forEach((entry, index) => {
        Logger.info(`   ${index + 1}. ${entry.user_name} (Position: ${entry.position}, Count: ${entry.periodic_notification_count || 0})`);
      });
    }

    // Check if automatic mode should be active
    const shouldBeActive = queueEntries.length > 0;
    const automaticModeActive = settings.automatic_mode;
    const currentlyActive = settings.is_active;

    Logger.info(`🔧 DEBUG: Automatic Mode Analysis:`);
    Logger.info(`   - Queue count: ${queueEntries.length}`);
    Logger.info(`   - Should be active: ${shouldBeActive}`);
    Logger.info(`   - Automatic mode enabled: ${automaticModeActive}`);
    Logger.info(`   - Currently active: ${currentlyActive}`);

    if (automaticModeActive) {
      if (shouldBeActive && !currentlyActive) {
        Logger.info(`⚠️  DEBUG: Queue should be ACTIVE but is INACTIVE`);
      } else if (!shouldBeActive && currentlyActive) {
        Logger.info(`⚠️  DEBUG: Queue should be INACTIVE but is ACTIVE`);
      } else {
        Logger.info(`✅ DEBUG: Queue state is correct`);
      }
    } else {
      Logger.info(`ℹ️  DEBUG: Automatic mode is disabled`);
    }

  } catch (error) {
    Logger.error('❌ DEBUG: Error checking queue status', error);
  }
}

/**
 * Main monitoring function - simple and reliable
 */
async function monitorQueue() {
  if (isProcessing) {
    Logger.info('Already processing, skipping this cycle');
    return;
  }

  isProcessing = true;
  Logger.info('🔍 Starting queue monitoring cycle');

  try {
    // Get current data
    const [activeSessions, queueEntries] = await Promise.all([
      fetchActiveSessions(),
      fetchQueue()
    ]);

    Logger.info(`Found ${activeSessions.length} active sessions and ${queueEntries.length} queue entries`);

    // Handle automatic mode first
    await handleAutomaticMode(queueEntries.length);

    if (queueEntries.length === 0) {
      Logger.info('Queue is empty');
      return;
    }

    // Get user data for queue entries
    const userIds = queueEntries.filter(e => e.user_id).map(e => e.user_id);
    const userData = await getUserGizmoIds(userIds);

    // Check for logged-in users to remove
    const activeGizmoIds = new Set(activeSessions.map(s => s.userId));
    const toRemove = [];

    for (const entry of queueEntries) {
      if (entry.user_id && userData[entry.user_id]) {
        const gizmoId = userData[entry.user_id].gizmo_id;
        if (gizmoId && activeGizmoIds.has(gizmoId)) {
          toRemove.push({ entry, reason: 'logged_in_to_computer' });
        }
      }
    }

    // Remove logged-in users
    if (toRemove.length > 0) {
      Logger.info(`Removing ${toRemove.length} logged-in users`);
      for (const { entry, reason } of toRemove) {
        await removeFromQueue(entry.id, entry.user_name, reason);
      }
      
      // Re-check automatic mode after removals
      const remainingCount = queueEntries.length - toRemove.length;
      if (remainingCount !== queueEntries.length) {
        Logger.info(`Queue count changed from ${queueEntries.length} to ${remainingCount}, re-checking automatic mode`);
        await handleAutomaticMode(remainingCount);
      }
    }

    // Check for notification needs
    const now = new Date();
    for (const entry of queueEntries) {
      // Skip if we're about to remove this user
      if (toRemove.some(r => r.entry.id === entry.id)) continue;

      const createdAt = new Date(entry.created_at);
      const lastNotified = entry.last_notified_at ? new Date(entry.last_notified_at) : null;
      
      // Get phone number
      let phoneNumber = entry.phone_number;
      if (!phoneNumber && entry.user_id && userData[entry.user_id]) {
        phoneNumber = userData[entry.user_id].phone;
      }

      if (!phoneNumber) continue;

      // Check if needs notification
      let shouldNotify = false;
      let isYourTurn = false;
      let notificationReason = '';

      // Calculate time since last notification for debugging
      const timeSinceLastNotification = lastNotified ? (now - lastNotified) / 1000 / 60 : null; // in minutes

      // SMART NOTIFICATION SYSTEM 
      // - Notify once when user joins
      // - Notify immediately when position improves  
      // - For position #1: Max 3 "your turn" reminders (2 min apart), then stop
      // - For positions 2-5: Max 2 periodic updates (15 min apart), then stop
      // - Positions 6+: No notifications (too far back)
      // - Counter resets when position changes
      shouldNotify = false;
      isYourTurn = false;
      notificationReason = '';

      // 1. New joiner (never been notified)
      if (!lastNotified) {
        shouldNotify = true;
        isYourTurn = entry.position === 1;
        notificationReason = 'first_notification';
        Logger.info(`🔔 ${entry.user_name} - First time notification (position ${entry.position})`);
      }
      // 2. Position improved (moved up in queue)
      else if (entry.last_notified_position && entry.position < entry.last_notified_position) {
        shouldNotify = true;
        isYourTurn = entry.position === 1;
        notificationReason = `position_improved_${entry.last_notified_position}_to_${entry.position}`;
        Logger.info(`🔔 ${entry.user_name} - Position improved (${entry.last_notified_position} → ${entry.position})`);
        
        // Reset notification count when position improves
        await supabase
          .from('computer_queue')
          .update({ periodic_notification_count: 0 })
          .eq('id', entry.id);
      }
      // 3. Smart retry system for position #1 (Your turn!)
      else if (entry.position === 1) {
        const notificationCount = entry.periodic_notification_count || 0;
        const minTimeBetweenRetries = 120000; // 2 minutes between retries
        
        // Only retry if:
        // - Haven't exceeded max attempts (3 total)
        // - Enough time has passed since last notification
        // - Still at the same position as last notification
        if (notificationCount < 3 && 
            (!lastNotified || (now - lastNotified) > minTimeBetweenRetries) &&
            entry.last_notified_position === entry.position) {
          
          shouldNotify = true;
          isYourTurn = true;
          notificationReason = `your_turn_attempt_${notificationCount + 1}`;
          Logger.info(`🔔 ${entry.user_name} - Your turn reminder #${notificationCount + 1}/3 (last: ${timeSinceLastNotification?.toFixed(1)}m ago)`);
        } else {
          Logger.info(`⏭️ ${entry.user_name} (pos 1) - Max attempts reached (${notificationCount}/3) or too soon`);
        }
      }
      // 4. Periodic updates for positions 2-5 (less frequent)
      else if (entry.position >= 2 && entry.position <= 5) {
        const notificationCount = entry.periodic_notification_count || 0;
        const minTimeBetweenUpdates = 900000; // 15 minutes between periodic updates
        
        // Only send periodic updates:
        // - Max 2 times per position
        // - 15 minutes between updates
        // - Still at same position
        if (notificationCount < 2 && 
            lastNotified && 
            (now - lastNotified) > minTimeBetweenUpdates &&
            entry.last_notified_position === entry.position) {
          
          shouldNotify = true;
          isYourTurn = false;
          notificationReason = `periodic_update_${notificationCount + 1}`;
          Logger.info(`🔔 ${entry.user_name} - Periodic update #${notificationCount + 1}/2 (position ${entry.position})`);
        } else {
          Logger.info(`⏭️ ${entry.user_name} (pos ${entry.position}) - No periodic update needed (${notificationCount}/2 sent)`);
        }
      }
      // 5. No notifications for positions 6+ (too far back)
      else {
        Logger.info(`⏭️ ${entry.user_name} (pos ${entry.position}) - Too far back for notifications`);
      }

      if (shouldNotify) {
        Logger.info(`📱 Sending notification to ${entry.user_name} (position ${entry.position}) - Reason: ${notificationReason}`);
        
        const result = await sendWhatsAppNotification(
          phoneNumber,
          entry.user_name,
          entry.position,
          isYourTurn
        );

        if (result.success) {
          await updateNotificationStatus(entry.id, entry.position);
          
          // Increment notification count for smart retry system
          if (notificationReason.startsWith('your_turn_attempt_') || 
              notificationReason.startsWith('periodic_update_')) {
            await supabase
              .from('computer_queue')
              .update({ periodic_notification_count: (entry.periodic_notification_count || 0) + 1 })
              .eq('id', entry.id);
          }
          
          Logger.success(`✅ Notified ${entry.user_name} about ${notificationReason}`);
        }

        // Small delay between notifications
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    Logger.success('Queue monitoring cycle completed');

  } catch (error) {
    Logger.error('Error in monitoring cycle', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Main execution
 */
async function main() {
  Logger.success('🚀 Simple Queue Monitor Started');
  Logger.info('📊 Polling every 10 seconds - simple and reliable');

  // Check if debug mode is enabled
  const debugMode = process.argv.includes('--debug');
  if (debugMode) {
    Logger.info('🔍 DEBUG MODE ENABLED - will show detailed logs');
  }

  // Initial debug check if in debug mode
  if (debugMode) {
    await debugQueueStatus();
  }

  // Initial run
  await monitorQueue();

  // Set up interval
  const interval = setInterval(async () => {
    await monitorQueue();
    
    // Run debug check every 5 minutes in debug mode
    if (debugMode && Math.random() < 0.1) { // ~10% chance each cycle (roughly every 5 minutes)
      await debugQueueStatus();
    }
  }, 10000); // Every 10 seconds

  // Graceful shutdown
  process.on('SIGINT', () => {
    Logger.info('Shutting down...');
    clearInterval(interval);
    Logger.success('Stopped gracefully');
    process.exit(0);
  });

  Logger.success('✅ System ready - monitoring every 10 seconds');
  Logger.info('💡 Use --debug flag for detailed logging');
  Logger.info('💡 Features: Auto-removal, WhatsApp notifications, Automatic mode control');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    Logger.error('Fatal error', error);
    process.exit(1);
  });
}

module.exports = {
  monitorQueue,
  handleAutomaticMode,
  debugQueueStatus,
  fetchQueue,
  fetchActiveSessions
}; 