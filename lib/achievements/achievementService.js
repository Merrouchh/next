/**
 * Service for handling achievement-related database operations
 */

// Import the new API function
// import { addGameTimeToUser } from '../../utils/api'; // Removed unused import

/**
 * Mark an achievement as completed in the database
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {string} achievementId - Achievement ID to mark as completed
 * @returns {Promise} - Database operation promise
 */
export const markAchievementCompleted = async (supabase, userId, achievementId) => {
  // First check if achievement exists and is claimed
  const { data: existingAchievement } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)
    .single();
  
  // If already claimed, don't change the status
  if (existingAchievement?.status === 'claimed') {
    return { data: existingAchievement, skipped: true }; // Return without changing
  }
  
  // If no existing record, or status needs to be updated to 'completed'
  return await supabase
    .from('user_achievements')
    .upsert({
      user_id: userId,
      achievement_id: achievementId,
      status: 'completed',
      completed_at: existingAchievement?.completed_at || new Date().toISOString()
    }, {
      onConflict: 'user_id,achievement_id',
      ignoreDuplicates: false
    });
};

/**
 * Update multiple achievements in the database
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {string[]} achievementIds - Array of achievement IDs to mark as completed
 */
export const updateAchievementsInDatabase = async (supabase, userId, achievementIds) => {
  const promises = achievementIds.map(id => markAchievementCompleted(supabase, userId, id));
  await Promise.allSettled(promises);
};

/**
 * Check if a user has both liked AND commented on clips
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - Whether the user has both liked and commented on clips
 */
export const checkUserHasInteracted = async (supabase, userId) => {
  if (!userId) return false;
  
  try {
    // Check for likes first
    const { count: likesCount, error: likesError } = await supabase
      .from('video_likes')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .limit(1);
      
    if (likesError || likesCount === 0) {
      return false;
    }
    
    // If we found likes, check for comments
    const { count: commentsCount, error: commentsError } = await supabase
      .from('clip_comments')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .limit(1);
      
    // Return true only if the user has both liked AND commented
    return !commentsError && commentsCount > 0;
  } catch {
    return false;
  }
};

/**
 * Mark an achievement as claimed and update user points
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {string} achievementId - Achievement ID to claim
 * @param {number} points - Points to award
 * @param {string} completedAt - ISO date string of completion time
 * @returns {Promise<object>} - Object containing updated user data
 */
export const claimAchievement = async (supabase, userId, achievementId, points, completedAt) => {
  try {
    const now = new Date().toISOString();
    
    // 1. First check if the achievement exists 
    const { data: existingAchievement } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .eq('achievement_id', achievementId)
      .single();
    
    // if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    //   throw checkError;
    // }
    
    // 2. Mark achievement as claimed in database
    const { error: upsertError } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: achievementId,
        status: 'claimed',
        completed_at: completedAt || existingAchievement?.completed_at || now,
        claimed_at: now,
        was_notified: existingAchievement?.was_notified || true,
        notified_at: existingAchievement?.notified_at
      }, {
        onConflict: 'user_id,achievement_id',
        returning: 'representation'
      });
    
    if (upsertError) {
      throw upsertError;
    }
    
    // 3. Update points in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single();
    
    if (userError) {
      throw userError;
    }
    
    const currentPoints = userData?.points || 0;
    const newTotal = currentPoints + points;
    
    const { data: updatedData, error: updateError } = await supabase
      .from('users')
      .update({ points: newTotal })
      .eq('id', userId)
      .select('points')
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    return {
      success: true,
      points: updatedData.points
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if a user has clip uploads
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - Whether the user has clips
 */
export const checkUserHasClips = async (supabase, userId) => {
  if (!userId) return false;
  
  try {
    // Try the clips table
    const { count: clipCount, error: clipsError } = await supabase
      .from('clips')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .limit(1);
    
    if (!clipsError && clipCount > 0) {
      return true;
    }
    
    // Try user_clips table as a fallback
    const { count: userClipCount, error: userClipsError } = await supabase
      .from('user_clips')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .limit(1);
    
    return !userClipsError && userClipCount > 0;
  } catch {
    return false;
  }
};

/**
 * Check if a user has participated in tournaments
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - Whether the user has participated in tournaments
 */
export const checkTournamentParticipation = async (supabase, userId) => {
  if (!userId) return false;
  
  try {
    // Check event_registrations
    const { count: regCount, error: regError } = await supabase
      .from('event_registrations')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    if (!regError && regCount > 0) {
      return true;
    }
    
    // Check team memberships
    const { count: teamCount, error: teamError } = await supabase
      .from('event_team_members')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    if (!teamError && teamCount > 0) {
      return true;
    }
    
    // Check if user is an organizer
    const { count: eventsCount, error: eventsError } = await supabase
      .from('events')
      .select('id', { count: 'exact' })
      .eq('organizer_id', userId);
    
    return !eventsError && eventsCount > 0;
  } catch {
    return false;
  }
};

/**
 * Submit a review screenshot for verification
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {File} file - File object to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<object>} - Result of the operation
 */
export const submitReviewScreenshot = async (supabase, userId, file, onProgress) => {
  try {
    // 1. Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `public/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    // 2. Upload file to Supabase Storage
    const { error } = await supabase.storage
      .from('review-screenshots')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        onUploadProgress: (progress) => {
          if (onProgress) {
            onProgress(Math.round((progress.loaded / progress.total) * 100));
          }
        }
      });
    
    if (error) throw error;
    
    // 3. Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('review-screenshots')
      .getPublicUrl(fileName);
    
    const screenshotUrl = publicUrlData.publicUrl;
    
    // 4. Record the review in the database
    const { error: reviewError } = await supabase.from('user_reviews').insert({
      user_id: userId,
      screenshot_url: screenshotUrl,
      submitted_at: new Date().toISOString(),
      verified: false
    });
    
    if (reviewError) throw reviewError;
    
    // 5. Update the achievement status to "pending verification"
    const { error: achievementError } = await supabase
      .from('user_achievements')
      .upsert({
        user_id: userId,
        achievement_id: 'five-star-review',
        status: 'pending_verification'
      }, {
        onConflict: 'user_id,achievement_id'
      });
      
    if (achievementError) throw achievementError;
    
    return { success: true, url: screenshotUrl };
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Mark an achievement as notified in the database
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {string} achievementId - Achievement ID to mark as notified
 * @returns {Promise<object>} - Operation result
 */
export const markAchievementNotified = async (supabase, userId, achievementId) => {
  try {
    // Store notification state in the database
    const { data, error } = await supabase
      .from('user_achievements')
      .update({
        was_notified: true,
        notified_at: new Date().toISOString()
      })
      .match({ 
        user_id: userId, 
        achievement_id: achievementId 
      });
    
    if (error) {
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * Add game hours to a user as a reward
 * @param {object} supabase - Supabase client instance
 * @param {string} userId - User ID
 * @param {number} hours - Number of hours to add
 * @returns {Promise<object>} - Result of the operation
 */
export const addGameHours = async (supabase, userId, hours) => {
  try {
    if (!userId || !hours) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Convert hours to seconds (1 hour = 3600 seconds)
    const seconds = Math.floor(hours * 3600);
    console.log(`[INTERNAL API] Converting ${hours} hours to ${seconds} seconds`);

    // Call the internal API that handles authentication server-side
    const response = await fetch('/api/internal/add-game-time-reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        seconds: seconds,
        price: 0 // Free reward
      })
    });

    const result = await response.json();
    
    // Log the result for debugging
    if (result.success) {
      console.log(`[INTERNAL API] SUCCESS: Added ${hours} hours (${seconds} seconds) to user ${userId}`);
    } else {
      console.error(`[INTERNAL API] FAILED: Could not add ${hours} hours (${seconds} seconds) to user:`, result.error);
    }

    return result;
  } catch (error) {
    console.error('Error in addGameHours:', error);
    return { success: false, error: error.message };
  }
}; 