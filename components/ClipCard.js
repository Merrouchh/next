import { useState, useCallback, useRef, useEffect } from 'react';
import { MdFavorite, MdFavoriteBorder, MdVisibility, MdPerson, MdExpandMore, 
  MdPublic, MdLock, MdDelete, MdShare, MdClose } from 'react-icons/md';
import styles from '../styles/ClipCard.module.css';
import VideoPlayer from './VideoPlayer';
import { useLikes } from '../hooks/useLikes';
import LikesModal from './LikesModal';
import DeleteClipModal from './DeleteClipModal';
import { useAuth } from '../contexts/AuthContext';
import VisibilityModal from './VisibilityModal';
import ShareModal from './ShareModal';
import { useRouter } from 'next/router';
import ExpandedTitleModal from './ExpandedTitleModal';

const ClipCard = ({ 
  clip, 
  isFullWidth = false, 
  onClipUpdate = null // Make it optional with default null
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showFullTitle, setShowFullTitle] = useState(false);
  const titleRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { user, supabase } = useAuth();
  const [clipData, setClipData] = useState(clip);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const cardRef = useRef(null);
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });

  const {
    liked,
    likesCount,
    isUpdatingLike,
    likesList,
    handleLike
  } = useLikes(clipData.id, clipData.likes_count || 0, user);

  const isOwner = user?.id === clipData.user_id;
  const isPublic = clipData.visibility === 'public';

  const handleLoadingChange = useCallback((loading) => {
    setIsLoading(loading);
  }, []);

  // Handle scroll to hide expanded title
  useEffect(() => {
    const handleScroll = () => {
      if (showFullTitle) {
        setShowFullTitle(false);
      }
    };

    if (showFullTitle) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [showFullTitle]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (titleRef.current && !titleRef.current.contains(event.target)) {
        setShowFullTitle(false);
      }
    };

    if (showFullTitle) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFullTitle]);

  // Check if title is truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (titleRef.current) {
        const { scrollWidth, clientWidth } = titleRef.current;
        setIsTruncated(scrollWidth > clientWidth);
      }
    };

    checkTruncation();
    // Also check on window resize
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [clipData.title]);

  // Calculate modal position relative to card
  const updateModalPosition = useCallback(() => {
    if (cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const isDesktop = window.innerWidth >= 768;
      
      setModalPosition({
        top: cardRect.top + window.scrollY + (cardRect.height / 2),
        left: cardRect.left + (isDesktop ? cardRect.width : cardRect.width / 2)
      });
    }
  }, []);

  // Update position when showing modal or on scroll/resize
  useEffect(() => {
    if (showLikesModal) {
      updateModalPosition();
      window.addEventListener('scroll', updateModalPosition);
      window.addEventListener('resize', updateModalPosition);
    }

    return () => {
      window.removeEventListener('scroll', updateModalPosition);
      window.removeEventListener('resize', updateModalPosition);
    };
  }, [showLikesModal, updateModalPosition]);

  const handleVisibilityToggle = async (newVisibility) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from('clips')
        .update({ visibility: newVisibility })
        .eq('id', clipData.id)
        .single();

      if (error) throw error;

      // Update local state
      setClipData(prev => ({ ...prev, visibility: newVisibility }));
      
      // Handle different page scenarios
      if (router.pathname === '/discover' && newVisibility === 'private') {
        // Fade out and remove from discover page
        setTimeout(() => {
          setClipData(null);
        }, 300);
      } else if (typeof onClipUpdate === 'function') {
        // Update in profile page
        onClipUpdate(clipData.id, 'visibility', { visibility: newVisibility });
      }

    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setShowVisibilityModal(false);
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('clips')
        .delete()
        .eq('id', clipData.id);

      if (error) throw error;

      // Call onClipUpdate after successful deletion
      onClipUpdate?.(clipData.id, 'delete');
      
    } catch (error) {
      console.error('Error deleting clip:', error);
    } finally {
      setIsUpdating(false);
      setShowDeleteModal(false);
    }
  };

  const handleTitleClick = () => {
    if (isTruncated) {
      setShowFullTitle(true);
    }
  };

  const handleCloseTitle = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFullTitle(false);
      setIsClosing(false);
    }, 200);
  };

  // If clip is deleted or made private (on discover page), don't render anything
  if (!clipData) return null;

  return (
    <div className={styles.cardContainer}>
      <div className={`${styles.card} ${isUpdating ? styles.updating : ''}`}>
        <div className={styles.cardHeader}>
          <div className={styles.userInfo}>
            <MdPerson />
            <span className={styles.username}>{clipData.username || 'Anonymous'}</span>
          </div>
          
          <div className={styles.titleContainer}>
            <h3 
              ref={titleRef}
              className={`${styles.title} ${isTruncated ? styles.clickable : ''}`}
              onClick={() => isTruncated && setShowTitleModal(true)}
            >
              {clipData.title || 'Untitled Clip'}
            </h3>
          </div>
        </div>

        <div className={styles.videoContainer}>
          <VideoPlayer clip={clip} user={user} onLoadingChange={setIsLoading} />
        </div>

        <div className={styles.stats}>
          {isOwner && (
            <div className={styles.ownerActions}>
              <button
                className={styles.actionButton}
                onClick={() => setShowVisibilityModal(true)}
                disabled={isUpdating}
                title={`Change visibility`}
              >
                {isPublic ? (
                  <MdPublic data-visibility="public" />
                ) : (
                  <MdLock data-visibility="private" />
                )}
              </button>
              <button
                className={styles.actionButton}
                onClick={() => setShowDeleteModal(true)}
                disabled={isUpdating}
                title="Delete clip"
              >
                <MdDelete />
              </button>
            </div>
          )}

          <div className={styles.actionGroup}>
            <div className={styles.likeContainer}>
              <button 
                className={`${styles.statButton} ${liked ? styles.liked : ''}`}
                onClick={handleLike}
                disabled={!user || isUpdatingLike}
              >
                {liked ? <MdFavorite /> : <MdFavoriteBorder />}
                <span>{likesCount}</span>
              </button>
              {likesCount > 0 && (
                <button 
                  className={styles.showLikesButton}
                  onClick={() => setShowLikesModal(true)}
                >
                  Show likes
                </button>
              )}
            </div>

            <button
              className={styles.actionButton}
              onClick={() => setShowShareModal(true)}
              title="Share clip"
            >
              <MdShare />
            </button>
          </div>

          <div className={styles.stat}>
            <MdVisibility />
            <span>{clipData.views_count || 0}</span>
          </div>

          {clipData.game && (
            <div className={styles.gameTag}>
              {clipData.game}
            </div>
          )}
        </div>

        <div className={styles.modalContainer}>
          <DeleteClipModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDelete}
          />
          <VisibilityModal
            isOpen={showVisibilityModal}
            onClose={() => setShowVisibilityModal(false)}
            isPublic={isPublic}
            onConfirm={handleVisibilityToggle}
            isUpdating={isUpdating}
          />
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            clipId={clipData.id}
          />
          <ExpandedTitleModal
            isOpen={showTitleModal}
            onClose={() => setShowTitleModal(false)}
            title={clipData.title || 'Untitled Clip'}
          />
        </div>
      </div>
      {showLikesModal && (
        <div className={styles.likesModalWrapper}>
          <LikesModal
            isOpen={showLikesModal}
            onClose={() => setShowLikesModal(false)}
            likes={likesList}
            isLoadingLikes={isUpdatingLike}
          />
        </div>
      )}
    </div>
  );
};

export default ClipCard;