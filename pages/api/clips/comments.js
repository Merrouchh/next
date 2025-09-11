import { createClient } from '../../../utils/supabase/server-props';
import { markAchievementCompleted } from '../../../lib/achievements/achievementService';

/**
 * API route for handling video clip comments
 * Supports:
 * - GET: Fetch comments for a clip
 * - POST: Add a new comment
 * - PUT: Update an existing comment
 * - DELETE: Delete a comment
 */
export default async function handler(req, res) {
  // Create Supabase client with admin privileges
  const supabase = createClient({ req, res });

  // Get authenticated user (secure method)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Check authentication
  if (userError || !user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Switch based on HTTP method
  switch (req.method) {
    case 'GET':
      return getComments(req, res, supabase, user);
    case 'POST':
      return addComment(req, res, supabase, user);
    case 'PUT':
      return updateComment(req, res, supabase, user);
    case 'DELETE':
      return deleteComment(req, res, supabase, user);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * GET handler - Fetch comments for a clip
 */
async function getComments(req, res, supabase) {
  try {
    const { clipId, limit = 10, page = 0 } = req.query;

    if (!clipId) {
      return res.status(400).json({ error: 'Missing clipId parameter' });
    }

    // First check if the clip exists and if it's public or user has access
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('visibility, user_id')
      .eq('id', clipId)
      .single();

    if (clipError) {
      console.error('Error fetching clip:', clipError);
      return res.status(404).json({ error: 'Clip not found' });
    }

    // Check access - if private, only owner can see comments
    const isPublic = clip.visibility === 'public';
    const isOwner = user?.id === clip.user_id;

    if (!isPublic && !isOwner) {
      return res.status(403).json({ error: 'Access denied to private clip comments' });
    }

    // Get comment count
    const { count, error: countError } = await supabase
      .from('clip_comments')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clipId);

    if (countError) {
      console.error('Error counting comments:', countError);
      return res.status(500).json({ error: 'Failed to count comments' });
    }

    // Get paginated comments
    const offset = parseInt(page) * parseInt(limit);
    const { data: comments, error } = await supabase
      .from('clip_comments')
      .select('*')
      .eq('clip_id', clipId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }

    return res.status(200).json({ comments, count });
  } catch (error) {
    console.error('Unexpected error in getComments:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * POST handler - Add a new comment
 */
async function addComment(req, res, supabase) {
  try {

    const { clipId, content } = req.body;

    if (!clipId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First check if the clip exists
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('id, visibility')
      .eq('id', clipId)
      .single();

    if (clipError) {
      console.error('Error fetching clip:', clipError);
      return res.status(404).json({ error: 'Clip not found' });
    }

    // Prevent commenting on private clips for non-owners
    if (clip.visibility === 'private' && clip.user_id !== session.user.id) {
      return res.status(403).json({ error: 'Cannot comment on private clips' });
    }

    // Get user info
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Insert comment
    const { data: comment, error } = await supabase
      .from('clip_comments')
      .insert({
        clip_id: clipId,
        user_id: session.user.id,
        username: userProfile.username || session.user.email,
        content
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      return res.status(500).json({ error: 'Failed to add comment' });
    }

    // Only trigger first-interaction achievement when the user has both liked and commented
    try {
      // Check if the user has liked any clips
      const { count: likesCount, error: likesError } = await supabase
        .from('video_likes')
        .select('id', { count: 'exact' })
        .eq('user_id', session.user.id)
        .limit(1);
        
      if (!likesError && likesCount > 0) {
        // User has both commented and liked, so award the achievement
        await markAchievementCompleted(supabase, session.user.id, 'first-interaction');
      }
    } catch (achievementError) {
      console.error('Error checking/triggering achievement:', achievementError);
      // Non-fatal, continue with comment submission
    }

    return res.status(201).json(comment);
  } catch (error) {
    console.error('Unexpected error in addComment:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * PUT handler - Update an existing comment
 */
async function updateComment(req, res, supabase) {
  try {

    const { commentId, content } = req.body;

    if (!commentId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // First check if the comment exists and belongs to the user
    const { data: comment, error: fetchError } = await supabase
      .from('clip_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError) {
      console.error('Error fetching comment:', fetchError);
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership
    if (comment.user_id !== session.user.id) {
      return res.status(403).json({ error: 'Cannot edit another user\'s comment' });
    }

    // Update the comment
    const { data: updatedComment, error } = await supabase
      .from('clip_comments')
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating comment:', error);
      return res.status(500).json({ error: 'Failed to update comment' });
    }

    return res.status(200).json(updatedComment);
  } catch (error) {
    console.error('Unexpected error in updateComment:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}

/**
 * DELETE handler - Delete a comment
 */
async function deleteComment(req, res, supabase, user) {
  try {

    const { commentId } = req.query;

    if (!commentId) {
      return res.status(400).json({ error: 'Missing commentId parameter' });
    }

    // First check if the comment exists and belongs to the user
    const { data: comment, error: fetchError } = await supabase
      .from('clip_comments')
      .select('user_id, clip_id')
      .eq('id', commentId)
      .single();

    if (fetchError) {
      console.error('Error fetching comment:', fetchError);
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check ownership or if user is the clip owner
    const isCommentOwner = comment.user_id === user.id;
    
    if (!isCommentOwner) {
      // Check if user is clip owner
      const { data: clip, error: clipError } = await supabase
        .from('clips')
        .select('user_id')
        .eq('id', comment.clip_id)
        .single();
        
      if (clipError || clip.user_id !== session.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
    }

    // Delete the comment
    const { error } = await supabase
      .from('clip_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return res.status(500).json({ error: 'Failed to delete comment' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Unexpected error in deleteComment:', error);
    return res.status(500).json({ error: 'Server error' });
  }
} 