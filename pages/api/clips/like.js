import { createClient } from '../../../utils/supabase/server-props';
import { markAchievementCompleted } from '../../../lib/achievements/achievementService';

/**
 * API route for handling video clip likes
 * Supports:
 * - POST: Add or remove a like
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create Supabase client
  const supabase = createClient({ req, res });

  // Get authenticated user (more secure than getSession)
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  // Check authentication
  if (authError || !user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { clipId } = req.body;

    if (!clipId) {
      return res.status(400).json({ error: 'Missing clipId parameter' });
    }

    // Check if like exists
    const { data: existingLike, error: likeError } = await supabase
      .from('video_likes')
      .select('id')
      .eq('clip_id', clipId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (likeError && likeError.code !== 'PGRST116') {
      console.error('Error checking like status:', likeError);
      return res.status(500).json({ error: 'Failed to check like status' });
    }

    let action = 'added';
    
    if (existingLike) {
      // Unlike if already liked
      const { error: unlikeError } = await supabase
        .from('video_likes')
        .delete()
        .eq('clip_id', clipId)
        .eq('user_id', user.id);

      if (unlikeError) {
        console.error('Error removing like:', unlikeError);
        return res.status(500).json({ error: 'Failed to remove like' });
      }
      
      action = 'removed';
    } else {
      // Like if not already liked
      const { error: likeError } = await supabase
        .from('video_likes')
        .insert({
          clip_id: clipId,
          user_id: user.id
        });

      if (likeError) {
        console.error('Error adding like:', likeError);
        return res.status(500).json({ error: 'Failed to add like' });
      }
      
      // Only trigger first-interaction achievement when the user has both liked and commented
      try {
        // Check if the user has commented on any clips
        const { count: commentsCount, error: commentsError } = await supabase
          .from('clip_comments')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .limit(1);
          
        if (!commentsError && commentsCount > 0) {
          // User has both liked and commented, so award the achievement
          await markAchievementCompleted(supabase, user.id, 'first-interaction');
        }
      } catch (achievementError) {
        console.error('Error checking/triggering achievement:', achievementError);
        // Non-fatal, continue with like submission
      }
    }

    // Get updated like count
    const { count, error: countError } = await supabase
      .from('video_likes')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clipId);

    if (countError) {
      console.error('Error counting likes:', countError);
    }

    return res.status(200).json({ 
      success: true,
      action,
      count: count || 0
    });
  } catch (error) {
    console.error('Unexpected error in like handler:', error);
    return res.status(500).json({ error: 'Server error' });
  }
} 