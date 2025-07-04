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
const fs = require('fs');
const path = require('path');

// ===== LOGGING SYSTEM =====
const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'queue-monitor-errors.log');
const INFO_LOG = path.join(LOG_DIR, 'queue-monitor-info.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB max per log file

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Simple logging system with file rotation
 */
class Logger {
  static rotateLogIfNeeded(logPath) {
    if (fs.existsSync(logPath)) {
      const stats = fs.statSync(logPath);
      if (stats.size > MAX_LOG_SIZE) {
        const backupPath = logPath.replace('.log', `-${Date.now()}.log`);
        fs.renameSync(logPath, backupPath);
        // Keep only last 5 backup files
        const logDir = path.dirname(logPath);
        const baseName = path.basename(logPath, '.log');
        const files = fs.readdirSync(logDir)
          .filter(f => f.startsWith(baseName) && f.includes('-'))
          .sort()
          .reverse();
        files.slice(5).forEach(f => {
          fs.unlinkSync(path.join(logDir, f));
        });
      }
    }
  }

  static writeLog(level, message, logPath) {
    try {
      this.rotateLogIfNeeded(logPath);
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level}] ${message}\n`;
      fs.appendFileSync(logPath, logEntry);
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Logging failed:', error.message);
    }
  }

  static error(message, error = null) {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    this.writeLog('ERROR', fullMessage, ERROR_LOG);
    console.error(`❌ ${fullMessage}`); // Keep critical errors in console
  }

  static warn(message) {
    this.writeLog('WARN', message, INFO_LOG);
    // Only show warnings in console during development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ ${message}`);
    }
  }

  static info(message, showInConsole = false) {
    this.writeLog('INFO', message, INFO_LOG);
    if (showInConsole || process.env.NODE_ENV !== 'production') {
      console.log(`ℹ️ ${message}`);
    }
  }

  static success(message, showInConsole = true) {
    this.writeLog('SUCCESS', message, INFO_LOG);
    if (showInConsole) {
      console.log(`✅ ${message}`);
    }
  }

  static debug(message) {
    // Only log debug messages in development
    if (process.env.NODE_ENV !== 'production') {
      this.writeLog('DEBUG', message, INFO_LOG);
      console.log(`🔍 ${message}`);
    }
  }
}

// Log startup
Logger.info('Queue Monitor starting up', true);

// Use built-in fetch (Node.js 18+) or import node-fetch with timeout wrapper
async function getFetch() {
  const baseFetch = (typeof globalThis.fetch !== 'undefined') 
    ? globalThis.fetch 
    : (await import('node-fetch')).default;
  
  // Return fetch with timeout wrapper
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000); // 30s default timeout
    
    try {
      const response = await baseFetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${(options.timeout || 30000)/1000}s: ${url}`);
      }
      throw error;
    }
  };
}

// Configuration - try both naming conventions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const API_AUTH = process.env.API_AUTH;
const INFOBIP_API_KEY = process.env.INFOBIP_API_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !API_BASE_URL || !API_AUTH) {
  Logger.error('Missing required environment variables');
  Logger.error(`NEXT_PUBLIC_SUPABASE_URL: ${!!SUPABASE_URL}`);
  Logger.error(`SUPABASE_SERVICE_ROLE_KEY: ${!!SUPABASE_SERVICE_KEY}`);
  Logger.error(`API_BASE_URL: ${!!API_BASE_URL}`);
  Logger.error(`API_AUTH: ${!!API_AUTH}`);
  Logger.error('Create a .env.local file with required variables - check logs for details');
  process.exit(1);
}

// Optional WhatsApp notifications
if (!INFOBIP_API_KEY) {
  Logger.warn('INFOBIP_API_KEY not found - WhatsApp notifications will be disabled');
} else {
  Logger.success('WhatsApp notifications enabled via Infobip');
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Remove complex global variables - we'll use database instead
// let queueSnapshot = new Map();  // REMOVED - too complex
// let updateTimeout = null;       // REMOVED - too complex
// let recentNotifications = new Map(); // REMOVED - too complex
let processingNotifications = false; // Simple flag
let processingBatchId = null; // Prevent duplicate batch processing
let isProcessing = false; // Additional protection against concurrent processing
let activeSubscription = null; // Track active subscription for cleanup
let subscriptionLastEvent = 0; // Track last subscription event time
let lastHealthCheck = 0; // Track last health check time
let consecutiveErrors = 0; // Track consecutive errors for circuit breaker
let whatsappRateLimit = { 
  calls: 0, 
  resetTime: 0,
  dailyCalls: 0,
  dailyResetTime: 0,
  consecutiveFailures: 0
}; // Rate limiting for WhatsApp API

/**
 * Check and apply rate limiting for WhatsApp API
 */
function checkWhatsAppRateLimit() {
  const now = Date.now();
  const maxCallsPerMinute = 10; // Limit to 10 calls per minute
  const maxCallsPerDay = 1000; // Limit to 1000 calls per day (adjust based on your plan)
  
  // Reset daily counter (every 24 hours)
  if (now > whatsappRateLimit.dailyResetTime) {
    whatsappRateLimit.dailyCalls = 0;
    whatsappRateLimit.dailyResetTime = now + (24 * 60 * 60 * 1000); // Next day
    Logger.info('Daily WhatsApp rate limit reset');
  }
  
  // Reset minute counter
  if (now > whatsappRateLimit.resetTime) {
    whatsappRateLimit.calls = 0;
    whatsappRateLimit.resetTime = now + 60000; // Next minute
  }
  
  // Check if too many consecutive failures (circuit breaker)
  if (whatsappRateLimit.consecutiveFailures >= 10) {
    Logger.warn(`WhatsApp temporarily disabled due to ${whatsappRateLimit.consecutiveFailures} consecutive failures`);
    return false;
  }
  
  // Check daily limit
  if (whatsappRateLimit.dailyCalls >= maxCallsPerDay) {
    const hoursLeft = Math.ceil((whatsappRateLimit.dailyResetTime - now) / (60 * 60 * 1000));
    Logger.warn(`Daily WhatsApp limit reached (${maxCallsPerDay}/day), ${hoursLeft}h until reset`);
    return false;
  }
  
  // Check per-minute limit
  if (whatsappRateLimit.calls >= maxCallsPerMinute) {
    const waitTime = Math.ceil((whatsappRateLimit.resetTime - now) / 1000);
    Logger.warn(`WhatsApp rate limit reached (${maxCallsPerMinute}/min), waiting ${waitTime}s`);
    return false;
  }
  
  whatsappRateLimit.calls++;
  whatsappRateLimit.dailyCalls++;
  return true;
}

/**
 * Send WhatsApp notification with simple retry logic
 */
async function sendWhatsAppNotification(phoneNumber, userName, position, isYourTurn = false) {
  if (!INFOBIP_API_KEY) {
    Logger.debug('WhatsApp disabled - no API key');
    return { success: false, reason: 'no_api_key' };
  }

  if (!phoneNumber) {
    Logger.debug('No phone number provided');
    return { success: false, reason: 'no_phone' };
  }

  // Apply rate limiting
  if (!checkWhatsAppRateLimit()) {
    return { success: false, reason: 'rate_limited' };
  }

  try {
    const templateType = isYourTurn ? 'your_turn' : 'queue_joined';
    const params = { userName, position };
    
    Logger.info(`📱 Sending ${templateType} to ${userName} (position ${position})`);
    
    const result = await sendWhatsAppQueueNotification(phoneNumber, templateType, params);
    
    if (result.success) {
      Logger.success(`✅ WhatsApp sent to ${userName}`, true);
      
      // Reset consecutive failures on success
      whatsappRateLimit.consecutiveFailures = 0;
    } else {
      Logger.warn(`❌ WhatsApp failed for ${userName}: ${result.error || result.reason}`);
      whatsappRateLimit.consecutiveFailures++;
    }
    
    return result;
    
  } catch (error) {
    Logger.error(`💥 WhatsApp error for ${userName}`, error);
    whatsappRateLimit.consecutiveFailures++;
    return { success: false, error: error.message, reason: 'send_failed' };
  }
}

/**
 * Simple notification checker - runs every 10 seconds
 * Much more reliable than complex real-time subscriptions
 */
async function checkForNotifications() {
  if (processingNotifications) {
    Logger.debug('Already processing notifications, skipping');
    return;
  }
  
  processingNotifications = true;
  
  try {
    Logger.debug('🔍 Checking for notification updates...');
    
    // Get current queue state
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select(`
        id, 
        user_name, 
        phone_number, 
        computer_type, 
        position, 
        user_id,
        created_at,
        last_notified_at
      `)
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      Logger.error('Error fetching queue for notifications', error);
      return;
    }

    if (!currentQueue || currentQueue.length === 0) {
      Logger.debug('No queue entries found');
      return;
    }

    // Enhance with phone numbers from users table
    const enhancedQueue = await enhanceQueueWithPhoneNumbers(currentQueue);
    
    Logger.debug(`Found ${enhancedQueue.length} people in queue`);

    // Process each person
    for (const person of enhancedQueue) {
      const effectivePhone = getEffectivePhoneNumber(person);
      
      if (!effectivePhone) {
        Logger.debug(`${person.user_name} has no phone number, skipping`);
        continue;
      }

      // Check if we need to send notification
      const needsNotification = shouldSendNotification(person);
      
      if (needsNotification.send) {
        Logger.info(`🎯 Sending notification to ${person.user_name}: ${needsNotification.reason}`);
        
        const result = await sendWhatsAppNotification(
          effectivePhone, 
          person.user_name, 
          person.position, 
          person.position === 1
        );
        
        if (result.success) {
          // Update database to mark as notified
          await updateNotificationStatus(person.id, person.position);
          Logger.success(`📝 Updated notification status for ${person.user_name}`);
        }
        
        // Add small delay between notifications to be polite to API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    Logger.debug('✅ Notification check completed');
    
  } catch (error) {
    Logger.error('💥 Error in notification checker', error);
  } finally {
    processingNotifications = false;
  }
}

/**
 * Simple logic to determine if someone needs a notification
 */
function shouldSendNotification(person) {
  const now = new Date();
  const createdAt = new Date(person.created_at);
  const lastNotifiedAt = person.last_notified_at ? new Date(person.last_notified_at) : null;
  
  // Person just joined (created in last 30 seconds) and never been notified
  if (!lastNotifiedAt && (now - createdAt) < 30000) {
    return { send: true, reason: 'new_joiner' };
  }
  
  // Person was notified more than 5 minutes ago - send position update
  if (lastNotifiedAt && (now - lastNotifiedAt) > 300000) {
    return { send: true, reason: 'position_update' };
  }
  
  // Person reached position 1 and hasn't been notified in last 2 minutes
  if (person.position === 1 && (!lastNotifiedAt || (now - lastNotifiedAt) > 120000)) {
    return { send: true, reason: 'your_turn' };
  }
  
  return { send: false, reason: 'no_notification_needed' };
}

/**
 * Update notification status in database
 */
async function updateNotificationStatus(queueId, position) {
  try {
    const { error } = await supabase
      .from('computer_queue')
      .update({ 
        last_notified_at: new Date().toISOString(),
        last_notified_position: position
      })
      .eq('id', queueId);
    
    if (error) {
      Logger.error('Error updating notification status', error);
    }
  } catch (error) {
    Logger.error('Error in updateNotificationStatus', error);
  }
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
      Logger.error('Error fetching user phone numbers', error);
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
    Logger.error('Error in enhanceQueueWithPhoneNumbers', error);
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
 * Fetch active user sessions from Gizmo API
 */
async function fetchActiveUserSessions() {
  try {
    const fetch = await getFetch();
    const response = await fetch(`${API_BASE_URL}/usersessions/active`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // 15 second timeout for API calls
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch active sessions: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    Logger.error('Error fetching active sessions', error);
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
    Logger.error('Error fetching queue', error);
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
    Logger.error('Error fetching user gizmo IDs', error);
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
          Logger.debug(`Found username "${username}" for gizmo_id ${session.userId}`);
        }
      }
    } catch (error) {
      Logger.error(`Error fetching username for gizmo_id ${session.userId}`, error);
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

    Logger.success(`Removed ${userName} from queue (${reason})`);
    return true;
  } catch (error) {
    Logger.error(`Failed to remove ${userName} from queue`, error);
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
      Logger.debug('Could not fetch queue settings for automatic mode check');
      return;
    }

    if (!settings.automatic_mode) {
      Logger.debug('Automatic mode is disabled, skipping auto-control');
      return;
    }

    const shouldBeActive = currentQueueCount > 0;
    
    if (shouldBeActive && !settings.is_active) {
      // Auto-start queue when people join
      Logger.info('Automatic mode: Starting queue (people in queue)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: true })
        .eq('id', 1);
        
      if (updateError) {
        Logger.error('Failed to auto-start queue', updateError);
      } else {
        Logger.success('Auto-started queue system');
      }
    } else if (!shouldBeActive && settings.is_active) {
      // Auto-stop queue when empty
      Logger.info('Automatic mode: Stopping queue (queue is empty)');
      const { error: updateError } = await supabase
        .from('queue_settings')
        .update({ is_active: false })
        .eq('id', 1);
        
      if (updateError) {
        Logger.error('Failed to auto-stop queue', updateError);
      } else {
        Logger.success('Auto-stopped queue system');
      }
    }
  } catch (error) {
    Logger.error('Error handling automatic mode', error);
  }
}

/**
 * Main monitoring function
 */
async function monitorQueue() {
  Logger.debug('Starting queue monitoring cycle');

  // Perform health check before processing
  const isHealthy = await performHealthCheck();
  if (!isHealthy && consecutiveErrors >= 3) {
    Logger.warn('Skipping monitoring cycle due to health check failures');
    return;
  }

  try {
    // 1. Fetch active sessions and current queue in parallel
    const [activeSessions, queueEntries] = await Promise.all([
      fetchActiveUserSessions(),
      fetchCurrentQueue()
    ]);

    Logger.info(`Found ${activeSessions.length} active sessions and ${queueEntries.length} people in queue`, true);

    if (queueEntries.length === 0) {
      Logger.info('Queue is empty, checking automatic mode');
      // Even if queue is empty, check if we need to auto-stop the queue system
      await handleAutomaticMode(0);
      return;
    }

    // 2. Get gizmo_ids for users in queue (users with website accounts)
    const userGizmoIds = await getUserGizmoIds(queueEntries);
    Logger.debug(`Found ${Object.keys(userGizmoIds).length} queue users with linked website accounts`);

    // 3. Get usernames for active sessions (for manual entries without website accounts)
    const activeSessionUsernames = await getActiveSessionUsernames(activeSessions);
    Logger.debug(`Found ${Object.keys(activeSessionUsernames).length} active session usernames`);

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

    if (usersToRemove.length > 0) {
      Logger.info(`Found ${usersToRemove.length} users to remove from queue`, true);
      
      for (const { queueEntry, reason } of usersToRemove) {
        await removeUserFromQueue(queueEntry.id, queueEntry.user_name, reason);
        
        // Small delay between removals to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate remaining queue count after removals
      const remainingQueueCount = queueEntries.length - usersToRemove.length;
      
      // Check automatic mode after changes
      await handleAutomaticMode(remainingQueueCount);

      Logger.success(`Queue monitoring complete - removed ${usersToRemove.length} users`);
    } else {
      Logger.debug('No users need to be removed from queue');
      
      // Still check automatic mode in case queue state needs updating
      await handleAutomaticMode(queueEntries.length);
    }

  } catch (error) {
    Logger.error('Error during queue monitoring', error);
  }
}

/**
 * Health check function to verify system connectivity
 */
async function performHealthCheck() {
  const now = Date.now();
  
  // Only check every 5 minutes
  if (now - lastHealthCheck < 300000) {
    return true;
  }
  
  try {
    Logger.debug('Performing health check');
    
    // Test database connectivity
    const { error } = await supabase
      .from('computer_queue')
      .select('id')
      .limit(1);
    
    if (error) {
      throw new Error(`Database health check failed: ${error.message}`);
    }
    
    // Test API connectivity
    const fetch = await getFetch();
    const response = await fetch(`${API_BASE_URL}/usersessions/active`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(API_AUTH).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout for health check
    });
    
    if (!response.ok) {
      throw new Error(`API health check failed: ${response.status}`);
    }
    
    consecutiveErrors = 0; // Reset error counter on success
    lastHealthCheck = now;
    Logger.debug('Health check passed');
    return true;
    
  } catch (error) {
    consecutiveErrors++;
    Logger.error(`Health check failed (${consecutiveErrors} consecutive)`, error);
    
    // Circuit breaker: if too many consecutive errors, pause monitoring
    if (consecutiveErrors >= 5) {
      Logger.error('Circuit breaker activated - too many consecutive failures');
      Logger.warn('Pausing monitoring for 2 minutes...');
      await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minute pause
      consecutiveErrors = 0; // Reset after pause
    }
    
    return false;
  }
}

/**
 * Clean up all resources to prevent memory leaks
 */
async function cleanupResources() {
  Logger.info('Cleaning up resources...');
  
  // Clean up subscriptions
  if (activeSubscription) {
    try {
      await activeSubscription.unsubscribe();
    } catch (error) {
      Logger.error('Error unsubscribing', error);
    }
    activeSubscription = null;
  }
  
  // Reset processing flags
  isProcessing = false;
  processingBatchId = null;
  
  // Reset health check and rate limiting
  lastHealthCheck = 0;
  consecutiveErrors = 0;
  subscriptionLastEvent = 0;
  whatsappRateLimit = { 
    calls: 0, 
    resetTime: 0,
    dailyCalls: 0,
    dailyResetTime: 0,
    consecutiveFailures: 0
  };
  
  Logger.success('Resources cleaned up');
}

/**
 * Handle graceful shutdown
 */
function setupGracefulShutdown() {
  const handleShutdown = async (signal) => {
    Logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
      await cleanupResources();
      Logger.success('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      Logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  
  // Handle uncaught exceptions to prevent crashes
  process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception', error);
    handleShutdown('UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    Logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
    handleShutdown('UNHANDLED_REJECTION');
  });
}

/**
 * Start simple notification monitoring
 */
async function startSimpleNotificationMonitoring() {
  Logger.success('🚀 Starting SIMPLE notification system');
  Logger.info('📊 Database-backed, polling every 10 seconds');
  
  // Initial check
  await checkForNotifications();
  
  // Set up simple interval - much more reliable than complex subscriptions
  const notificationInterval = setInterval(async () => {
    await checkForNotifications();
  }, 10000); // Every 10 seconds - simple and reliable
  
  Logger.success('✅ Simple notification system started');
  return notificationInterval;
}

/**
 * Main execution
 */
async function main() {
  Logger.success('Queue Monitor started');
  Logger.info('Auto-removal system for logged-in users initialized');
  
  setupGracefulShutdown();

  // Check execution mode
  const runOnce = process.argv.includes('--once');
  const realTime = process.argv.includes('--realtime');
  
  if (runOnce) {
    Logger.info('Running in single-execution mode');
    await monitorQueue();
    Logger.success('Single execution completed');
    process.exit(0);
  } else if (realTime) {
    Logger.success('Running in real-time mode with WhatsApp notifications');
    Logger.info('Use Ctrl+C to stop');
    
    // Start simple notification monitoring
    const notificationInterval = await startSimpleNotificationMonitoring();
    
    // Run user removal check immediately and then every 30 seconds
    await monitorQueue();
    const interval = setInterval(async () => {
      await monitorQueue();
    }, 30000); // 30 seconds for more responsive auto-removal
    
    // Set up periodic cleanup to prevent memory leaks during long runs
    const cleanupInterval = setInterval(async () => {
      await checkForNotifications();
    }, 300000); // Every 5 minutes
    
    // Cleanup on shutdown
    process.on('SIGINT', async () => {
      Logger.info('Shutting down real-time monitoring...');
      clearInterval(interval);
      clearInterval(cleanupInterval);
      if (notificationInterval) {
        clearInterval(notificationInterval);
      }
      await cleanupResources();
      Logger.success('Stopped gracefully');
      process.exit(0);
    });
    
    // Keep the process alive
    Logger.success('Features enabled: Auto-removal (30s), Simple notifications, Automatic mode');
    
  } else {
    Logger.success('Running in periodic mode (every 60 seconds)');
    Logger.info('Use Ctrl+C to stop, --once for single execution, or --realtime for WhatsApp notifications');
    
    // Run immediately
    await monitorQueue();
    
    // Then run every 60 seconds
    const periodicInterval = setInterval(async () => {
      await monitorQueue();
    }, 60000); // 60 seconds
    
    // Set up periodic cleanup for periodic mode too
    const periodicCleanupInterval = setInterval(async () => {
      await checkForNotifications();
    }, 300000); // Every 5 minutes
    
    // Enhanced cleanup for periodic mode
    process.on('SIGINT', async () => {
      Logger.info('Shutting down periodic monitoring...');
      clearInterval(periodicInterval);
      clearInterval(periodicCleanupInterval);
      await cleanupResources();
      Logger.success('Stopped gracefully');
      process.exit(0);
    });
    
    Logger.success('Features enabled: Auto-removal (60s), Simple notifications, Automatic mode');
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    Logger.error('Fatal error - shutting down', error);
    process.exit(1);
  });
}

module.exports = {
  monitorQueue,
  fetchActiveUserSessions,
  fetchCurrentQueue
}; 