import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCommentsByClipId, addComment, deleteComment, updateComment } from '../utils/supabase/comments';
import { useAuth } from '../contexts/AuthContext';
import { MdSend, MdEdit, MdDelete, MdClose, MdCheck, MdPerson, MdExpandLess, MdExpandMore } from 'react-icons/md';
import styles from '../styles/CommentsSection.module.css';

/**
 * Component for displaying and managing comments for a clip
 * 
 * @param {Object} props Component props
 * @param {number} props.clipId The ID of the clip to show comments for
 * @param {boolean} props.isCollapsible Whether the comments section can be collapsed
 * @param {boolean} props.initiallyExpanded Whether the comments section is expanded by default
 */
const CommentsSection = ({ clipId, isCollapsible = true, initiallyExpanded = true }) => {
  // State for comments data
  const [comments, setComments] = useState([]);
  const [totalComments, setTotalComments] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  
  // State for comment input
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for comment editing
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  
  // Reference for scrolling
  const commentsContainerRef = useRef(null);
  const commentInputRef = useRef(null);
  const isLoadingRef = useRef(false);
  
  // Auth context for user information
  const { user } = useAuth();
  
  // Constants
  const COMMENTS_PER_PAGE = 10;

  // Function to load comments
  const loadComments = useCallback(async (pageNum = 0, replace = false) => {
    if (!clipId || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fetchCommentsByClipId(clipId, COMMENTS_PER_PAGE, pageNum);
      
      if (replace) {
        setComments(result.comments);
      } else {
        setComments(prev => [...prev, ...result.comments]);
      }
      
      setTotalComments(result.count);
      setHasMore(result.comments.length === COMMENTS_PER_PAGE);
      setPage(pageNum);
      
      // Ensure loading is set to false after successful data fetch
      setIsLoading(false);
      isLoadingRef.current = false;
    } catch (err) {
      console.error('Error loading comments:', err);
      setError('Failed to load comments. Please try again.');
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [clipId]);

  // Load comments on mount and when clipId changes
  useEffect(() => {
    if (clipId && isExpanded) {
      loadComments(0, true);
    } else if (!clipId) {
      // Reset state when no clipId
      setComments([]);
      setTotalComments(0);
      setIsLoading(false);
      setError(null);
      isLoadingRef.current = false;
    }
  }, [clipId, isExpanded, loadComments]);
  
  // Function to scroll to the latest comment
  const scrollToLatestComment = useCallback(() => {
    if (commentsContainerRef.current && comments.length > 0) {
      // Scroll to the first comment (which is the latest since they're ordered by desc date)
      const firstComment = commentsContainerRef.current.querySelector(`.${styles.commentItem}`);
      if (firstComment) {
        firstComment.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [comments.length]);
  
  // Only scroll when a new comment is added by the current user
  useEffect(() => {
    if (comments.length > 0 && isSubmitting === false && commentText === '') {
      // This indicates we just submitted a comment
      scrollToLatestComment();
    }
  }, [comments, isSubmitting, commentText, scrollToLatestComment]);

  
  // Function to handle loading more comments
  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadComments(page + 1, false);
    }
  };
  
  // Function to handle comment submission
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    const trimmedComment = commentText.trim();
    if (!trimmedComment || isSubmitting || !user) return;
    
    setIsSubmitting(true);
    
    try {
      const newComment = await addComment(
        clipId,
        user.id,
        user.username,
        trimmedComment
      );
      
      if (newComment) {
        // Add to comments list
        setComments(prev => [newComment, ...prev]);
        // Update total count
        setTotalComments(prev => prev + 1);
        // Clear input
        setCommentText('');
        // Focus input for next comment
        commentInputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('Failed to submit comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to handle comment deletion
  const handleDeleteComment = async (commentId) => {
    if (!user || !commentId) return;
    
    // Optimistic update
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;
    
    const commentsCopy = [...comments];
    setComments(comments.filter(c => c.id !== commentId));
    setTotalComments(prev => prev - 1);
    
    try {
      const success = await deleteComment(commentId, user.id);
      
      if (!success) {
        // Restore comments if deletion failed
        setComments(commentsCopy);
        setTotalComments(prev => prev + 1);
        setError('Failed to delete comment. Please try again.');
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      // Restore comments
      setComments(commentsCopy);
      setTotalComments(prev => prev + 1);
      setError('Failed to delete comment. Please try again.');
    }
  };
  
  // Function to start editing a comment
  const handleStartEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };
  
  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };
  
  // Function to save an edited comment
  const handleSaveEdit = async (commentId) => {
    if (!user || !commentId) return;
    
    const trimmedComment = editingCommentText.trim();
    if (!trimmedComment) return;
    
    // Optimistic update
    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;
    
    const commentsCopy = [...comments];
    const updatedComments = [...comments];
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      content: trimmedComment,
      updated_at: new Date().toISOString()
    };
    
    setComments(updatedComments);
    setEditingCommentId(null);
    
    try {
      const updated = await updateComment(commentId, user.id, trimmedComment);
      
      if (!updated) {
        // Restore comments if update failed
        setComments(commentsCopy);
        setError('Failed to update comment. Please try again.');
      }
    } catch (err) {
      console.error('Error updating comment:', err);
      // Restore comments
      setComments(commentsCopy);
      setError('Failed to update comment. Please try again.');
    }
  };
  
  
  // Function to toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };
  

  return (
    <div className={styles.commentsSection}>
      {/* Header with toggle */}
      <div className={styles.header}>
        <h3>
          Comments ({totalComments})
        </h3>
        {isCollapsible && (
          <button 
            className={styles.toggleButton}
            onClick={toggleExpanded}
            aria-label={isExpanded ? 'Collapse comments' : 'Expand comments'}
          >
            {isExpanded ? <MdExpandLess /> : <MdExpandMore />}
          </button>
        )}
      </div>
      
      {isExpanded && (
        <>
          {/* Comment input */}
          {user ? (
            <form className={styles.commentForm} onSubmit={handleSubmitComment}>
              <input
                ref={commentInputRef}
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className={styles.commentInput}
                disabled={isSubmitting}
              />
              <button 
                type="submit" 
                className={styles.sendButton}
                disabled={!commentText.trim() || isSubmitting}
                aria-label="Post comment"
              >
                <MdSend />
              </button>
            </form>
          ) : (
            <div className={styles.loginPrompt}>
              Please log in to comment.
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className={styles.errorMessage}>
              {error}
              <button 
                onClick={() => setError(null)}
                className={styles.dismissButton}
                aria-label="Dismiss error"
              >
                <MdClose />
              </button>
            </div>
          )}
          
          {/* Comments list */}
          <div ref={commentsContainerRef} className={styles.commentsList}>
            {/* Show loading indicator only when actually loading and no comments yet */}
            {isLoading && comments.length === 0 && (
              <div className={styles.loadingIndicator}>
                <div className={styles.loadingSpinner}></div>
                Loading comments...
              </div>
            )}
            
            {/* Show no comments message when not loading and no comments exist */}
            {!isLoading && comments.length === 0 && (
              <div className={styles.noComments}>
                No comments yet. Be the first to comment!
              </div>
            )}
            
            {/* Show comments when they exist */}
            {comments.length > 0 && (
              comments.map(comment => (
                <div key={comment.id} className={styles.commentItem}>
                  <div className={styles.commentHeader}>
                    <div className={styles.commentUser}>
                      <MdPerson className={styles.userIcon} />
                      <span className={styles.username}>{comment.username}</span>
                    </div>
                    <span className={styles.commentDate}>
                      {new Date(comment.created_at).toLocaleDateString()} at {new Date(comment.created_at).toLocaleTimeString()}
                      {comment.updated_at !== comment.created_at && ' (edited)'}
                    </span>
                  </div>
                  
                  {editingCommentId === comment.id ? (
                    <div className={styles.editCommentForm}>
                      <input
                        type="text"
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        className={styles.editInput}
                        autoFocus
                      />
                      <div className={styles.editActions}>
                        <button 
                          onClick={() => handleSaveEdit(comment.id)}
                          className={styles.saveButton}
                          disabled={!editingCommentText.trim()}
                          aria-label="Save edit"
                        >
                          <MdCheck />
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className={styles.cancelButton}
                          aria-label="Cancel edit"
                        >
                          <MdClose />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.commentContent}>
                        {comment.content}
                      </div>
                      
                      {/* Only show edit/delete buttons for the comment owner */}
                      {user && user.id === comment.user_id && (
                        <div className={styles.commentActions}>
                          <button 
                            onClick={() => handleStartEdit(comment)}
                            className={styles.actionButton}
                            aria-label="Edit comment"
                          >
                            <MdEdit />
                          </button>
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className={styles.actionButton}
                            aria-label="Delete comment"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
            
            {/* Load more button */}
            {hasMore && comments.length > 0 && (
              <button 
                onClick={handleLoadMore}
                className={styles.loadMoreButton}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Load More Comments'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CommentsSection; 