import { createClient } from './component';

/**
 * Fetch comments for a specific clip
 * @param {number} clipId - The ID of the clip to fetch comments for
 * @param {number} limit - Maximum number of comments to return
 * @param {number} page - Page number for pagination (starts at 0)
 * @returns {Array} Array of comments with user information
 */
export const fetchCommentsByClipId = async (clipId, limit = 10, page = 0) => {
  if (!clipId) return { comments: [], count: 0 };
  
  try {
    const supabase = createClient();
    
    // Get the total count first
    const { count, error: countError } = await supabase
      .from('clip_comments')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clipId);
      
    if (countError) throw countError;
    
    // Then get paginated comments
    const { data, error } = await supabase
      .from('clip_comments')
      .select('*')
      .eq('clip_id', clipId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);
      
    if (error) throw error;
    
    return { 
      comments: data || [], 
      count: count || 0 
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return { comments: [], count: 0 };
  }
};

/**
 * Add a new comment to a clip
 * @param {number} clipId - The ID of the clip to comment on
 * @param {string} userId - The user ID of the commenter
 * @param {string} username - The username of the commenter
 * @param {string} content - The comment content
 * @returns {Object} The created comment or null on error
 */
export const addComment = async (clipId, userId, username, content) => {
  if (!clipId || !userId || !content) return null;
  
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('clip_comments')
      .insert({
        clip_id: clipId,
        user_id: userId,
        username,
        content
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding comment:', error);
    return null;
  }
};

/**
 * Delete a comment
 * @param {number} commentId - The ID of the comment to delete
 * @param {string} userId - The user ID of the requester (for authorization)
 * @returns {boolean} Success status
 */
export const deleteComment = async (commentId, userId) => {
  if (!commentId || !userId) return false;
  
  try {
    const supabase = createClient();
    
    // First check if the user owns this comment
    const { data: comment, error: fetchError } = await supabase
      .from('clip_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();
      
    if (fetchError) throw fetchError;
    
    // If the comment doesn't exist or user doesn't own it
    if (!comment || comment.user_id !== userId) {
      return false;
    }
    
    // Delete the comment
    const { error } = await supabase
      .from('clip_comments')
      .delete()
      .eq('id', commentId);
      
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
};

/**
 * Update a comment
 * @param {number} commentId - The ID of the comment to update
 * @param {string} userId - The user ID of the requester (for authorization)
 * @param {string} content - The new comment content
 * @returns {Object} The updated comment or null on error
 */
export const updateComment = async (commentId, userId, content) => {
  if (!commentId || !userId || !content) return null;
  
  try {
    const supabase = createClient();
    
    // First check if the user owns this comment
    const { data: comment, error: fetchError } = await supabase
      .from('clip_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();
      
    if (fetchError) throw fetchError;
    
    // If the comment doesn't exist or user doesn't own it
    if (!comment || comment.user_id !== userId) {
      return null;
    }
    
    // Update the comment
    const { data, error } = await supabase
      .from('clip_comments')
      .update({
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating comment:', error);
    return null;
  }
}; 