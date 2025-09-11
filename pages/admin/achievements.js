import React, { useState, useEffect, useCallback } from 'react';
// import { useRouter } from 'next/router'; // Removed unused import
import Head from 'next/head';
import { FaTrophy, FaCheck, FaTimes, FaEye, FaUserCircle, FaExternalLinkAlt } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import AdminPageWrapper from '../../components/AdminPageWrapper';
import styles from '../../styles/AchievementAdmin.module.css';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import { withServerSideAdmin } from '../../utils/supabase/server-admin';

export default function AchievementReviews() {
  const { user, supabase } = useAuth();
  // const router = useRouter(); // Removed unused variable
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const fetchPendingReviews = useCallback(async () => {
    setLoading(true);
    try {
      // Get all pending review screenshots
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('user_reviews')
        .select(`
          id, 
          user_id, 
          screenshot_url, 
          submitted_at, 
          verified,
          users:user_id (id, username, email)
        `)
        .eq('verified', false)
        .order('submitted_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      // Get achievement details for each user and check for duplicates
      const userReviewMap = new Map();
      
      for (let review of reviewsData) {
        // Check if we've already included a review from this user
        // If so, only keep the most recent one
        if (userReviewMap.has(review.user_id)) {
          const existingReview = userReviewMap.get(review.user_id);
          if (new Date(review.submitted_at) > new Date(existingReview.submitted_at)) {
            userReviewMap.set(review.user_id, review);
          }
        } else {
          userReviewMap.set(review.user_id, review);
        }
        
        // Get achievement details
        const { data: achievementData, error: achievementError } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', review.user_id)
          .eq('achievement_id', 'five-star-review')
          .single();

        if (!achievementError) {
          review.achievement = achievementData;
        }
      }
      
      // Convert map back to array, using only the most recent review per user
      const dedupedReviews = Array.from(userReviewMap.values());

      setPendingReviews(dedupedReviews || []);
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      toast.error('Failed to load pending reviews');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (user?.id) {
      fetchPendingReviews();
    }
  }, [user, fetchPendingReviews]);

  const handleViewImage = (url) => {
    setCurrentImageUrl(url);
    setShowImageModal(true);
  };

  const handleApproveReview = async (reviewId, userId) => {
    setProcessingId(reviewId);
    try {
      // 1. Update the review to verified
      const { error: reviewError } = await supabase
        .from('user_reviews')
        .update({ verified: true })
        .eq('id', reviewId);

      if (reviewError) throw reviewError;

      // 2. Update the achievement status
      const { data: achievementData, error: achievementError } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', 'five-star-review')
        .single();

      if (achievementError && achievementError.code !== 'PGRST116') {
        throw achievementError;
      }

      if (achievementData) {
        // Update existing record
        await supabase
          .from('user_achievements')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', achievementData.id);
      } else {
        // Create new record
        await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: 'five-star-review',
            status: 'completed',
            completed_at: new Date().toISOString()
          });
      }

      // 3. Refresh the list
      toast.success('Review approved successfully');
      fetchPendingReviews();
    } catch (error) {
      console.error('Error approving review:', error);
      toast.error('Failed to approve review');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectReview = async (reviewId, userId) => {
    setProcessingId(reviewId);
    try {
      // 1. Get screenshot URL before deleting the record
      const { data: reviewData, error: fetchError } = await supabase
        .from('user_reviews')
        .select('screenshot_url')
        .eq('id', reviewId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // 2. Delete the file from storage if it exists
      if (reviewData?.screenshot_url) {
        try {
          // Extract the filename from the URL
          const filename = reviewData.screenshot_url.split('/').pop();
          
          // First, list files in the public folder to find a match
          const { data: publicFiles } = await supabase
            .storage
            .from('review-screenshots')
            .list('public');
            
          // Look for the file in the results
          const matchingFile = publicFiles?.find(file => 
            file.name === filename || file.name.includes(filename.split('.')[0])
          );
          
          if (matchingFile) {
            // Delete with proper path including 'public/'
            const filePath = `public/${matchingFile.name}`;
            await supabase
              .storage
              .from('review-screenshots')
              .remove([filePath]);
          }
        } catch (storageError) {
          console.error('Failed to delete screenshot file:', storageError);
          // Continue with review deletion even if file deletion fails
        }
      }
      
      // 3. Delete the review record
      const { error: reviewError } = await supabase
        .from('user_reviews')
        .delete()
        .eq('id', reviewId);

      if (reviewError) throw reviewError;

      // 4. Set achievement status to incomplete
      const { data: achievementData, error: achievementError } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', 'five-star-review')
        .single();

      if (achievementError && achievementError.code !== 'PGRST116') {
        throw achievementError;
      }

      if (achievementData) {
        await supabase
          .from('user_achievements')
          .update({
            status: 'incomplete',
            completed_at: null
          })
          .eq('id', achievementData.id);
      }

      // 5. Refresh the list
      toast.success('Review rejected');
      fetchPendingReviews();
    } catch (error) {
      console.error('Error rejecting review:', error);
      toast.error('Failed to reject review');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminPageWrapper title="Achievement Reviews">
      <Head>
        <title>Achievement Reviews | Admin Dashboard</title>
        <meta name="description" content="Review and approve user achievement claims" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className={styles.achievementAdminContainer}>
        <header className={styles.adminHeader}>
          <div className={styles.headerContent}>
            <h1 className={styles.headerTitle}>
              <FaTrophy className={styles.headerIcon} />
              Achievement Reviews
            </h1>
            <p className={styles.headerDescription}>
              Review and verify user-submitted achievement screenshots
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.actionButton}
              onClick={fetchPendingReviews}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh List'}
            </button>
          </div>
        </header>

        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Loading pending reviews...</p>
          </div>
        ) : pendingReviews.length === 0 ? (
          <div className={styles.emptyState}>
            <FaTrophy className={styles.emptyIcon} />
            <h2>No Pending Reviews</h2>
            <p>All user achievement submissions have been reviewed.</p>
          </div>
        ) : (
          <div className={styles.reviewsTable}>
            <div className={styles.tableHeader}>
              <div className={styles.tableColumn}>User</div>
              <div className={styles.tableColumn}>Submitted</div>
              <div className={styles.tableColumn}>Screenshot</div>
              <div className={styles.tableColumn}>Actions</div>
            </div>
            
            {pendingReviews.map((review) => (
              <div key={review.id} className={styles.tableRow}>
                <div className={styles.tableColumn}>
                  <div className={styles.userInfo}>
                    <FaUserCircle className={styles.userAvatarFallback} />
                    <div className={styles.userDetails}>
                      <span className={styles.username}>{review.users.username}</span>
                      <Link 
                        href={`/profile/${review.users.username}`}
                        className={styles.profileLink}
                        target="_blank"
                      >
                        View Profile <FaExternalLinkAlt className={styles.externalLinkIcon} />
                      </Link>
                    </div>
                  </div>
                </div>
                <div className={styles.tableColumn}>
                  <div className={styles.submissionTime}>
                    {formatDate(review.submitted_at)}
                  </div>
                </div>
                <div className={styles.tableColumn}>
                  <button 
                    className={styles.viewButton}
                    onClick={() => handleViewImage(review.screenshot_url)}
                  >
                    <FaEye className={styles.buttonIcon} />
                    View Screenshot
                  </button>
                </div>
                <div className={styles.tableColumn}>
                  <div className={styles.actionButtons}>
                    <button 
                      className={styles.approveButton}
                      onClick={() => handleApproveReview(review.id, review.user_id)}
                      disabled={processingId === review.id}
                    >
                      <FaCheck className={styles.buttonIcon} />
                      Approve
                    </button>
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleRejectReview(review.id, review.user_id)}
                      disabled={processingId === review.id}
                    >
                      <FaTimes className={styles.buttonIcon} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Image preview modal */}
        {showImageModal && (
          <div className={styles.modalOverlay} onClick={() => setShowImageModal(false)}>
            <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowImageModal(false)}
              >
                <FaTimes />
              </button>
              <div className={styles.imageContainer}>
                <Image 
                  src={currentImageUrl} 
                  alt="Screenshot review" 
                  className={styles.modalImage}
                  width={800}
                  height={600}
                  unoptimized
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}

// Server-side authentication check - requires admin privileges
export const getServerSideProps = withServerSideAdmin(true); 