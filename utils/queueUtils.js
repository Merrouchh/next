/**
 * Queue Management Utilities
 * 
 * This module provides utilities for managing the queue system,
 * including automatic removal of users when they log into computers.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Remove a user from the queue by their gizmo_id
 * This function is called when a user successfully logs into a computer
 * 
 * @param {number} gizmoId - The user's gizmo ID
 * @param {string} reason - Reason for removal (for logging)
 * @returns {Promise<boolean>} - Success status
 */
export async function removeUserFromQueueByGizmoId(gizmoId, reason = 'logged into computer') {
  try {
    // First, find the user in our database by gizmo_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('gizmo_id', gizmoId)
      .single();

    if (userError || !userData) {
      // User not found in our database, might be a physical-only user
      console.log(`ℹ️ User with gizmo_id ${gizmoId} not found in database`);
      return false;
    }

    // Check if user is in the queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('computer_queue')
      .select('id, user_name, position')
      .eq('user_id', userData.id)
      .eq('status', 'waiting')
      .single();

    if (queueError || !queueEntry) {
      // User not in queue, nothing to do
      console.log(`ℹ️ User ${userData.username} (gizmo_id: ${gizmoId}) is not in queue`);
      return false;
    }

    // Remove user from queue
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', queueEntry.id);

    if (deleteError) {
      console.error(`❌ Failed to remove user ${userData.username} from queue:`, deleteError);
      return false;
    }

    console.log(`✅ Automatically removed ${userData.username} from queue (position ${queueEntry.position}) - ${reason}`);
    return true;

  } catch (error) {
    console.error('Error removing user from queue:', error);
    return false;
  }
}

/**
 * Remove a user from the queue by their user_id
 * 
 * @param {string} userId - The user's database ID
 * @param {string} reason - Reason for removal (for logging)
 * @returns {Promise<boolean>} - Success status
 */
export async function removeUserFromQueueByUserId(userId, reason = 'logged into computer') {
  try {
    // Check if user is in the queue
    const { data: queueEntry, error: queueError } = await supabase
      .from('computer_queue')
      .select('id, user_name, position')
      .eq('user_id', userId)
      .eq('status', 'waiting')
      .single();

    if (queueError || !queueEntry) {
      // User not in queue, nothing to do
      return false;
    }

    // Remove user from queue
    const { error: deleteError } = await supabase
      .from('computer_queue')
      .delete()
      .eq('id', queueEntry.id);

    if (deleteError) {
      console.error(`❌ Failed to remove user from queue:`, deleteError);
      return false;
    }

    console.log(`✅ Automatically removed ${queueEntry.user_name} from queue (position ${queueEntry.position}) - ${reason}`);
    return true;

  } catch (error) {
    console.error('Error removing user from queue by user ID:', error);
    return false;
  }
}

/**
 * Check if a user is in the queue
 * 
 * @param {string} userId - The user's database ID
 * @returns {Promise<object|null>} - Queue entry or null if not in queue
 */
export async function getUserQueueEntry(userId) {
  try {
    const { data: queueEntry, error } = await supabase
      .from('computer_queue')
      .select('id, user_name, position, computer_type, created_at')
      .eq('user_id', userId)
      .eq('status', 'waiting')
      .single();

    if (error) {
      return null;
    }

    return queueEntry;
  } catch (error) {
    console.error('Error checking user queue entry:', error);
    return null;
  }
}

/**
 * Get queue statistics
 * 
 * @returns {Promise<object>} - Queue statistics
 */
export async function getQueueStats() {
  try {
    const { data: queueEntries, error } = await supabase
      .from('computer_queue')
      .select('is_physical, computer_type')
      .eq('status', 'waiting');

    if (error) {
      throw error;
    }

    const stats = {
      total: queueEntries.length,
      physical: queueEntries.filter(entry => entry.is_physical).length,
      online: queueEntries.filter(entry => !entry.is_physical).length,
      anyComputer: queueEntries.filter(entry => entry.computer_type === 'any').length,
      topFloor: queueEntries.filter(entry => entry.computer_type === 'top').length,
      bottomFloor: queueEntries.filter(entry => entry.computer_type === 'bottom').length
    };

    return stats;
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return {
      total: 0,
      physical: 0,
      online: 0,
      anyComputer: 0,
      topFloor: 0,
      bottomFloor: 0
    };
  }
} 