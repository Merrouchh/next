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

// Queue state tracking for WhatsApp notifications
let queueSnapshot = new Map();
let updateTimeout = null;
let recentNotifications = new Map(); // Track recent notifications to prevent duplicates
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
 * Send WhatsApp notification using Infobip templates
 */
async function sendWhatsAppQueueNotification(phoneNumber, templateType, params = {}) {
  if (!INFOBIP_API_KEY) {
    Logger.debug('WhatsApp notifications disabled (no API key)');
    return { success: false, reason: 'no_api_key' };
  }

  if (!phoneNumber) {
    Logger.debug('No phone number provided, skipping WhatsApp notification');
    return { success: false, reason: 'no_phone' };
  }

  // Apply rate limiting
  if (!checkWhatsAppRateLimit()) {
    return { success: false, reason: 'rate_limited' };
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

    Logger.info(`Sending WhatsApp ${templateType} notification to ${formattedPhone}`);

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
      Logger.error('Error from Infobip API', new Error(JSON.stringify(responseData, null, 2)));
      throw new Error(`Failed to send WhatsApp message: ${responseData.error || responseData.message || 'Unknown error'}`);
    }

    Logger.success(`WhatsApp ${templateType} notification sent successfully to ${formattedPhone}`, false);
    
    // Reset consecutive failures on success
    whatsappRateLimit.consecutiveFailures = 0;
    
    return { 
      success: true, 
      messageId: responseData.messages?.[0]?.messageId,
      response: responseData 
    };

  } catch (error) {
    Logger.error(`Error sending WhatsApp ${templateType} notification`, error);
    
    // Increment consecutive failures
    whatsappRateLimit.consecutiveFailures++;
    Logger.warn(`WhatsApp consecutive failures: ${whatsappRateLimit.consecutiveFailures}/10`);
    
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
 * Check if we recently sent a notification to prevent duplicates
 */
function wasRecentlySent(userId, newPosition, userName = '') {
  const notificationKey = `${userId}_${newPosition}`;
  const lastSent = recentNotifications.get(notificationKey);
  const now = Date.now();
  
  // Clean up old entries first to prevent memory leaks
  cleanupRecentNotifications(now);
  
  // Consider "recent" as within the last 15 seconds (increased from 10)
  if (lastSent && (now - lastSent) < 15000) {
    Logger.debug(`Duplicate notification blocked for ${userName} (position ${newPosition}) - sent ${Math.round((now - lastSent)/1000)}s ago`);
    return true;
  }
  
  // Mark as sent
  recentNotifications.set(notificationKey, now);
  Logger.debug(`Notification allowed for ${userName} (position ${newPosition})`);
  
  return false;
}

/**
 * Clean up old notification entries to prevent memory leaks
 */
function cleanupRecentNotifications(now = Date.now()) {
  const cleanupThreshold = 60000; // 60 seconds
  const maxEntries = 1000; // Prevent unbounded growth
  
  // Remove old entries
  let removedCount = 0;
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > cleanupThreshold) {
      recentNotifications.delete(key);
      removedCount++;
    }
  }
  
  // If still too many entries, remove oldest ones
  if (recentNotifications.size > maxEntries) {
    const entries = Array.from(recentNotifications.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp
    
    const entriesToRemove = entries.slice(0, recentNotifications.size - maxEntries);
    entriesToRemove.forEach(([key]) => {
      recentNotifications.delete(key);
      removedCount++;
    });
  }
  
  if (removedCount > 0) {
    Logger.debug(`Cleaned up ${removedCount} old notification entries (${recentNotifications.size} remaining)`);
  }
}

/**
 * Reset WhatsApp consecutive failures periodically
 */
function resetWhatsAppFailures() {
  if (whatsappRateLimit.consecutiveFailures > 0) {
    Logger.debug(`Resetting WhatsApp consecutive failures from ${whatsappRateLimit.consecutiveFailures} to 0`);
    whatsappRateLimit.consecutiveFailures = Math.max(0, whatsappRateLimit.consecutiveFailures - 3);
  }
}

/**
 * Check subscription health and reconnect if needed
 */
async function checkSubscriptionHealth() {
  if (!activeSubscription) return true;
  
  const now = Date.now();
  const timeSinceLastEvent = now - subscriptionLastEvent;
  const maxIdleTime = 60 * 60 * 1000; // 1 hour of no events is suspicious
  
  // If no events for too long, assume subscription is stale
  if (subscriptionLastEvent > 0 && timeSinceLastEvent > maxIdleTime) {
    Logger.warn(`Subscription appears stale (${Math.round(timeSinceLastEvent/1000/60)}min since last event)`);
    Logger.info('Attempting to reconnect subscription...');
    
    try {
      // Unsubscribe from old connection
      await activeSubscription.unsubscribe();
      activeSubscription = null;
      
      // Wait a bit before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Reconnect
      const newSubscription = await startRealTimeMonitoring();
      Logger.success('Successfully reconnected subscription');
      return true;
      
    } catch (error) {
      Logger.error('Failed to reconnect subscription', error);
      return false;
    }
  }
  
  return true;
}

/**
 * Update queue snapshot and detect position changes for WhatsApp notifications
 */
async function updateQueueSnapshot() {
  Logger.debug('updateQueueSnapshot() starting');
  
  if (!INFOBIP_API_KEY) {
    Logger.debug('INFOBIP_API_KEY not found - skipping WhatsApp notifications');
    return; // Skip if WhatsApp is disabled
  }

  // Prevent concurrent processing with better protection
  if (isProcessing) {
    Logger.debug('Already processing queue snapshot, skipping this call');
    return;
  }

  const currentBatchId = Date.now();
  // Reset stale processing batch IDs (older than 30 seconds)
  if (processingBatchId && (currentBatchId - processingBatchId) > 30000) {
    Logger.warn(`Resetting stale processing batch ID (${Math.round((currentBatchId - processingBatchId)/1000)}s old)`);
    processingBatchId = null;
  }
  
  // Prevent processing the same batch multiple times
  if (processingBatchId && (currentBatchId - processingBatchId) < 2000) {
    Logger.debug(`Skipping duplicate batch processing (${Math.round((currentBatchId - processingBatchId)/1000)}s ago)`);
    return;
  }
  
  isProcessing = true;
  processingBatchId = currentBatchId;
  Logger.debug(`Processing batch ID: ${currentBatchId}`);

  try {
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, user_id')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      Logger.error('Error fetching current queue for notifications', error);
      return;
    }

    // Enhance queue data with phone numbers from users table
    const enhancedQueue = await enhanceQueueWithPhoneNumbers(currentQueue);

    Logger.debug(`Queue comparison: ${enhancedQueue.length} current vs ${queueSnapshot.size} in snapshot`);

    const newSnapshot = new Map();
    const positionChanges = [];
    const newJoiners = [];
    
    Logger.debug('Analyzing queue changes...');

    // Build new snapshot and detect changes
    enhancedQueue.forEach((person, index) => {
      newSnapshot.set(person.id, person);
      
      const oldPerson = queueSnapshot.get(person.id);
      
      if (!oldPerson) {
        // NEW person joining the queue
        Logger.info(`New joiner detected: ${person.user_name} at position ${person.position}`);
        newJoiners.push(person);
      } else if (oldPerson.position !== person.position) {
        // EXISTING person with position change
        Logger.info(`Position change: ${person.user_name} from ${oldPerson.position} to ${person.position}`);
        positionChanges.push({
          person,
          oldPosition: oldPerson.position,
          newPosition: person.position
        });
      }
    });

    // Send notifications to NEW people joining the queue
    for (const person of newJoiners) {
      const effectivePhone = getEffectivePhoneNumber(person);
      
      if (!effectivePhone) {
        Logger.debug(`${person.user_name} joined queue but no phone number`);
        continue;
      }

      // Check if we recently sent a notification for this person/position
      if (wasRecentlySent(person.id, person.position, person.user_name)) {
        Logger.debug(`${person.user_name} notification skipped (duplicate)`);
        continue;
      }

      try {
        let result;
        if (person.position === 1) {
          Logger.info(`Sending "your turn" notification to ${person.user_name}`);
          result = await notifyYourTurn(effectivePhone, person.user_name, person.computer_type);
        } else {
          Logger.info(`Sending "queue joined" notification to ${person.user_name} (position ${person.position})`);
          result = await notifyQueueJoined(effectivePhone, person.position, person.computer_type, person.user_name);
        }
        
        if (result.success) {
          Logger.success(`Welcome notification sent to ${person.user_name}`, false);
        } else {
          Logger.warn(`Failed to welcome ${person.user_name}: ${result.error || result.reason}`);
        }
      } catch (error) {
        Logger.error(`Error welcoming ${person.user_name}`, error);
      }
    }

    // Send notifications for position changes (with deduplication)
    for (const change of positionChanges) {
      const { person, oldPosition, newPosition } = change;
      const effectivePhone = getEffectivePhoneNumber(person);
      
      if (!effectivePhone) {
        Logger.debug(`${person.user_name} position changed but no phone number`);
        continue;
      }

      // Check if we recently sent a notification for this person/position
      if (wasRecentlySent(person.id, newPosition, person.user_name)) {
        Logger.debug(`${person.user_name} position change notification skipped (duplicate)`);
        continue;
      }

      try {
        let result;
        if (newPosition === 1) {
          Logger.info(`Sending "your turn" notification to ${person.user_name} (moved to position 1)`);
          result = await notifyYourTurn(effectivePhone, person.user_name, person.computer_type);
        } else {
          Logger.info(`Sending position update to ${person.user_name} (${oldPosition}→${newPosition})`);
          result = await notifyQueueJoined(effectivePhone, newPosition, person.computer_type, person.user_name);
        }
        
        if (result.success) {
          Logger.success(`Position notification sent to ${person.user_name}`, false);
        } else {
          Logger.warn(`Failed to notify ${person.user_name}: ${result.error || result.reason}`);
        }
      } catch (error) {
        Logger.error(`Error notifying ${person.user_name}`, error);
      }
    }

    // Update snapshot
    queueSnapshot = newSnapshot;
    
    if (newJoiners.length > 0 || positionChanges.length > 0) {
      Logger.info(`Processed ${newJoiners.length} new joiners and ${positionChanges.length} position changes`);
    } else {
      Logger.debug('No queue changes detected');
    }

  } catch (error) {
    Logger.error('Error updating queue snapshot for notifications', error);
  } finally {
    // Always reset processing flag to prevent permanent blocking
    isProcessing = false;
    // Reset batch ID after processing completes (success or error)
    processingBatchId = null;
  }
}

/**
 * Clean up queue snapshot to prevent memory leaks
 */
function cleanupQueueSnapshot() {
  const maxSnapshotSize = 500; // Prevent unbounded growth
  
  if (queueSnapshot.size > maxSnapshotSize) {
    Logger.warn(`Queue snapshot too large (${queueSnapshot.size}), clearing to prevent memory leak`);
    queueSnapshot.clear();
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
    Logger.info('Initializing queue snapshot for WhatsApp notifications...');
    
    // Clean up any existing snapshot first
    cleanupQueueSnapshot();
    
    const { data: currentQueue, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, phone_number, computer_type, position, user_id')
      .eq('status', 'waiting')
      .order('position', { ascending: true });

    if (error) {
      Logger.error('Error initializing queue snapshot', error);
      return;
    }

    // Enhance queue data with phone numbers from users table
    const enhancedQueue = await enhanceQueueWithPhoneNumbers(currentQueue);

    queueSnapshot = new Map();
    enhancedQueue.forEach(person => {
      queueSnapshot.set(person.id, person);
    });

    Logger.success(`Initialized WhatsApp monitoring with ${queueSnapshot.size} people in queue`);
  } catch (error) {
    Logger.error('Error in initializeQueueSnapshot', error);
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
      
      // Update WhatsApp notifications for position changes after removals
      await updateQueueSnapshot();
      
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
  
  // Clear timers
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }
  
  // Clean up subscriptions
  if (activeSubscription) {
    try {
      await activeSubscription.unsubscribe();
    } catch (error) {
      Logger.error('Error unsubscribing', error);
    }
    activeSubscription = null;
  }
  
  // Clear memory maps
  queueSnapshot.clear();
  recentNotifications.clear();
  
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
 * Start real-time queue monitoring with Supabase subscriptions
 */
async function startRealTimeMonitoring() {
  Logger.info('Starting real-time queue monitoring...');
  
  // Clean up any existing subscription first
  if (activeSubscription) {
    Logger.debug('Cleaning up existing subscription...');
    await activeSubscription.unsubscribe();
    activeSubscription = null;
  }
  
  // Initialize WhatsApp queue snapshot
  await initializeQueueSnapshot();
  
  // Initialize subscription health tracking
  subscriptionLastEvent = Date.now();
  
  // Set up real-time subscription to monitor queue changes with debouncing
  const subscription = supabase
    .channel('queue-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'computer_queue'
    }, async (payload) => {
      try {
        // Update last event timestamp for health monitoring
        subscriptionLastEvent = Date.now();
        
        Logger.debug(`Real-time event: ${payload.eventType} on ${payload.table}`);
        
        // Debounce rapid changes - clear existing timeout and set new one
        if (updateTimeout) {
          Logger.debug('Clearing existing timeout - batching multiple events');
          clearTimeout(updateTimeout);
        }
        
        updateTimeout = setTimeout(async () => {
          try {
            Logger.debug('Processing batched queue changes for notifications...');
            await updateQueueSnapshot();
          } catch (error) {
            Logger.error('Error processing queue changes', error);
          } finally {
            updateTimeout = null;
          }
        }, 3000); // Wait 3 seconds for all related changes to complete
        
      } catch (error) {
        Logger.error('Error handling real-time event', error);
      }
    })
    .subscribe();

  // Store active subscription for cleanup
  activeSubscription = subscription;
  
  Logger.success('Real-time WhatsApp notifications enabled');
  return subscription;
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
    
    // Start real-time monitoring for WhatsApp notifications
    const subscription = await startRealTimeMonitoring();
    
    // Run user removal check immediately and then every 30 seconds
    await monitorQueue();
    const interval = setInterval(async () => {
      await monitorQueue();
    }, 30000); // 30 seconds for more responsive auto-removal
    
    // Set up periodic cleanup to prevent memory leaks during long runs
    const cleanupInterval = setInterval(async () => {
      cleanupRecentNotifications();
      cleanupQueueSnapshot();
      resetWhatsAppFailures();
      await checkSubscriptionHealth();
    }, 300000); // Every 5 minutes
    
    // Cleanup on shutdown
    process.on('SIGINT', async () => {
      Logger.info('Shutting down real-time monitoring...');
      clearInterval(interval);
      clearInterval(cleanupInterval);
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
      try {
        await subscription.unsubscribe();
      } catch (error) {
        Logger.error('Error during subscription cleanup', error);
      }
      await cleanupResources();
      Logger.success('Stopped gracefully');
      process.exit(0);
    });
    
    // Keep the process alive
    Logger.success('Features enabled: Auto-removal (30s), Real-time WhatsApp, Automatic mode');
    
  } else {
    Logger.success('Running in periodic mode (every 60 seconds)');
    Logger.info('Use Ctrl+C to stop, --once for single execution, or --realtime for WhatsApp notifications');
    
    // Initialize WhatsApp monitoring for periodic mode too
    await initializeQueueSnapshot();
    
    // Run immediately
    await monitorQueue();
    
    // Then run every 60 seconds
    const periodicInterval = setInterval(async () => {
      await monitorQueue();
    }, 60000); // 60 seconds
    
    // Set up periodic cleanup for periodic mode too
    const periodicCleanupInterval = setInterval(() => {
      cleanupRecentNotifications();
      cleanupQueueSnapshot();
      resetWhatsAppFailures();
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
    
    Logger.success('Features enabled: Auto-removal (60s), Memory cleanup, Automatic mode');
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