import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../../contexts/AuthContext';
import LoadingScreen from '../../components/LoadingScreen';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/Profile.module.css';
import { 
  AiOutlineUser, AiOutlineEye, AiOutlineEyeInvisible, 
  AiOutlineDelete, 
} from 'react-icons/ai';
import { MdCloudUpload, MdFavorite, MdFavoriteBorder, MdShare } from 'react-icons/md';
import { FaGamepad, FaDiscord } from 'react-icons/fa';
import { SiValorant, SiBattledotnet } from 'react-icons/si';
import { GiPistolGun } from 'react-icons/gi';
import { fetchGizmoId, fetchUserPicture } from '../../utils/api';
import UserSearch from '../../components/UserSearch';

export default function ProfilePage() {
  const router = useRouter();
  const { username } = router.query;
  const { user, supabase } = useAuth();
  
  const [clips, setClips] = useState([]);
  const [likedClips, setLikedClips] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedClipId, setCopiedClipId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const CLIPS_PER_PAGE = 6;
  const [userPicture, setUserPicture] = useState(null);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState(null);
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [editedProfiles, setEditedProfiles] = useState({
    discord_id: '',
    valorant_id: '',
    fortnite_name: '',
    battlenet_id: ''
  });
  const [userExists, setUserExists] = useState(true);

  const isOwner = user?.username?.toLowerCase() === username?.toLowerCase();

  // Add function to check if user exists
  const checkUserExists = async (username) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (error || !data) {
        setUserExists(false);
        setLoading(false);
        return false;
      }
      
      setUserExists(true);
      return true;
    } catch (error) {
      console.error('Error checking user:', error);
      setUserExists(false);
      setLoading(false);
      return false;
    }
  };

  // Modify the initial useEffect
  useEffect(() => {
    if (!username) return;
    
    const initializePage = async () => {
      const exists = await checkUserExists(username);
      if (!exists) return;
      
      setPage(1);
      setHasMore(true);
      fetchUserClips(1, false);
    };

    initializePage();
  }, [username]);

  // Fetch likes only when user is logged in
  useEffect(() => {
    if (user) {
      fetchUserLikes();
    }
  }, [user]);

  // Add function to fetch user picture
  const fetchProfilePicture = async () => {
    setPictureLoading(true);
    try {
      const { gizmoId } = await fetchGizmoId(username);
      if (gizmoId) {
        const pictureUrl = await fetchUserPicture(gizmoId);
        setUserPicture(pictureUrl);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    } finally {
      setPictureLoading(false);
    }
  };

  // Add useEffect to fetch profile picture when username changes
  useEffect(() => {
    if (username) {
      fetchProfilePicture();
    }
  }, [username]);

  // Your provided functions here
  const fetchUserClips = async (pageNumber = 1, isLoadMore = false) => {
    if (!username) return;

    try {
      let query = supabase
        .from('clips')
        .select('*', { count: 'exact' })
        .eq('username', username)
        .order('uploaded_at', { ascending: false })
        .range((pageNumber - 1) * CLIPS_PER_PAGE, pageNumber * CLIPS_PER_PAGE - 1);

      // Only filter for public clips if the viewer is not the owner
      if (!isOwner) {
        query = query.eq('visibility', 'public');
      }

      const { data, error, count } = await query;

      if (error) throw error;

      const clipsWithUrls = await Promise.all(data.map(async (clip) => {
        if (!clip?.file_path) return null;
        
        // Get video URL
        const { data: videoData } = supabase.storage
          .from('highlight-clips')
          .getPublicUrl(clip.file_path);

        // Get thumbnail URL if it exists
        let thumbnailUrl = null;
        if (clip.thumbnail_path) {
          const { data: thumbnailData } = supabase.storage
            .from('highlight-clips')
            .getPublicUrl(clip.thumbnail_path);
          thumbnailUrl = thumbnailData?.publicUrl;
        }
        
        return {
          ...clip,
          url: videoData?.publicUrl,
          thumbnailUrl: thumbnailUrl || videoData?.publicUrl
        };
      }));

      const filteredClips = clipsWithUrls.filter(Boolean);
      
      // Update hasMore based on the total count
      setHasMore(count > pageNumber * CLIPS_PER_PAGE);
      
      // If loading more, append to existing clips, otherwise replace
      setClips(prev => isLoadMore ? [...prev, ...filteredClips] : filteredClips);
      
    } catch (err) {
      console.error('Error fetching clips:', err);
      setError('Failed to load clips');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLikes = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select('clip_id')
        .eq('user_id', user.id);

      if (error) throw error;

      const likes = {};
      data.forEach(like => {
        likes[like.clip_id] = true;
      });
      setLikedClips(likes);
    } catch (err) {
      console.error('Error fetching likes:', err);
    }
  };

  const handleLike = async (clipId) => {
    if (!user) {
      router.push('/');
      return;
    }

    try {
      const isLiked = likedClips[clipId];
      
      // First update optimistically
      setLikedClips(prev => ({
        ...prev,
        [clipId]: !isLiked
      }));

      setClips(prev => prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            likes_count: (clip.likes_count || 0) + (isLiked ? -1 : 1)
          };
        }
        return clip;
      }));

      if (isLiked) {
        // Unlike
        const { error: unlikeError } = await supabase
          .from('video_likes')
          .delete()
          .match({ user_id: user.id, clip_id: clipId });

        if (unlikeError) throw unlikeError;
      } else {
        // Like
        const { error: likeError } = await supabase
          .from('video_likes')
          .insert({ user_id: user.id, clip_id: clipId });

        if (likeError) throw likeError;
      }

      // Update likes count in database
      const { error: updateError } = await supabase
        .from('clips')
        .update({ 
          likes_count: clips.find(c => c.id === clipId).likes_count + (isLiked ? -1 : 1)
        })
        .eq('id', clipId);

      if (updateError) throw updateError;

    } catch (err) {
      console.error('Error updating like:', err);
      // Revert on error
      setLikedClips(prev => ({
        ...prev,
        [clipId]: !likedClips[clipId]
      }));

      setClips(prev => prev.map(clip => {
        if (clip.id === clipId) {
          return {
            ...clip,
            likes_count: (clip.likes_count || 0) + (likedClips[clipId] ? -1 : 1)
          };
        }
        return clip;
      }));
    }
  };

  const toggleVisibility = async (clip) => {
    try {
      const newVisibility = clip.visibility === 'public' ? 'private' : 'public';
      const { error } = await supabase
        .from('clips')
        .update({ visibility: newVisibility })
        .eq('id', clip.id);

      if (error) throw error;

      setClips(clips.map(c => 
        c.id === clip.id ? { ...c, visibility: newVisibility } : c
      ));
    } catch (err) {
      console.error('Error updating visibility:', err);
    }
  };

  const deleteClip = async (clip) => {
    if (!confirm('Are you sure you want to delete this clip?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('highlight-clips')
        .remove([clip.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('clips')
        .delete()
        .eq('id', clip.id);

      if (dbError) throw dbError;

      setClips(clips.filter(c => c.id !== clip.id));
    } catch (err) {
      console.error('Error deleting clip:', err);
    }
  };

  const handleShare = async (clip) => {
    try {
      const clipUrl = `${window.location.origin}/clip/${clip.id}`;
      if (navigator.share) {
        await navigator.share({
          title: clip.title || 'Gaming Clip',
          text: `Check out this gaming clip by ${clip.username}!`,
          url: clipUrl
        });
      } else {
        await navigator.clipboard.writeText(clipUrl);
        setCopiedClipId(clip.id);
        setTimeout(() => setCopiedClipId(null), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchUserClips(nextPage, true);
  };

  // Add function to fetch user profiles
  const fetchUserProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('discord_id, valorant_id, fortnite_name, battlenet_id')
        .eq('username', username)
        .single();

      if (error) throw error;
      setUserProfiles(data);
      setEditedProfiles(data);
    } catch (error) {
      console.error('Error fetching user profiles:', error);
    }
  };

  // Add useEffect to fetch profiles
  useEffect(() => {
    if (username) {
      fetchUserProfiles();
    }
  }, [username]);

  // Add function to handle profile updates
  const handleProfileUpdate = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update(editedProfiles)
        .eq('username', username);

      if (error) throw error;

      setUserProfiles(editedProfiles);
      setIsEditingProfiles(false);
    } catch (error) {
      console.error('Error updating profiles:', error);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>{username}'s Profile - Merrouch Gaming</title>
      </Head>
      {!userExists ? (
        <div className={styles.userNotFound}>
          <h1>User Not Found</h1>
          <p>The user "{username}" does not exist.</p>
          <button 
            onClick={() => router.push('/')}
            className={styles.backButton}
          >
            Back to Home Page
          </button>
        </div>
      ) : (
        <main className={styles.profileMain}>
          <div className={styles.profileHeader}>
            <div className={styles.profileTop}>
              <div className={styles.profileInfo}>
                <div className={styles.profileImageContainer}>
                  {pictureLoading ? (
                    <div className={styles.profileImageLoading}>
                      <div className={styles.spinner}></div>
                    </div>
                  ) : userPicture ? (
                    <img 
                      src={userPicture}
                      alt={`${username}'s profile`}
                      className={styles.profileImage}
                    />
                  ) : (
                    <div className={styles.profileImagePlaceholder}>
                      <AiOutlineUser className={styles.placeholderIcon} />
                    </div>
                  )}
                </div>
                <div className={styles.profileDetails}>
                  <h1>{username}'s Profile</h1>
                  <div className={styles.searchContainer}>
                    <UserSearch />
                  </div>
                </div>
              </div>
              {isOwner && (
                <button
                  onClick={() => router.push('/upload')}
                  className={styles.uploadButton}
                >
                  <MdCloudUpload />
                  Upload Clip
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.gamingProfiles}>
            <div className={styles.profilesHeader}>
              <h2>Gaming Profiles</h2>
              {isOwner && (
                <button 
                  onClick={() => setIsEditingProfiles(!isEditingProfiles)}
                  className={styles.editButton}
                >
                  {isEditingProfiles ? 'Cancel' : 'Edit Profiles'}
                </button>
              )}
            </div>

            {isEditingProfiles ? (
              <div className={styles.editProfiles}>
                <div className={styles.profileInput}>
                  <FaDiscord />
                  <input
                    type="text"
                    placeholder="Discord ID"
                    value={editedProfiles.discord_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      discord_id: e.target.value
                    }))}
                  />
                </div>
                <div className={styles.profileInput}>
                  <SiValorant />
                  <input
                    type="text"
                    placeholder="Valorant ID"
                    value={editedProfiles.valorant_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      valorant_id: e.target.value
                    }))}
                  />
                </div>
                <div className={styles.profileInput}>
                  <FaGamepad />
                  <input
                    type="text"
                    placeholder="Fortnite Display Name"
                    value={editedProfiles.fortnite_name || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      fortnite_name: e.target.value
                    }))}
                  />
                </div>
                <div className={styles.profileInput}>
                  <SiBattledotnet />
                  <input
                    type="text"
                    placeholder="Battle.net ID"
                    value={editedProfiles.battlenet_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      battlenet_id: e.target.value
                    }))}
                  />
                </div>
                <button 
                  onClick={handleProfileUpdate}
                  className={styles.saveButton}
                >
                  Save Profiles
                </button>
              </div>
            ) : (
              <div className={styles.profilesList}>
                {userProfiles?.discord_id && (
                  <div className={styles.profileItem}>
                    <FaDiscord />
                    <span className={styles.profileLabel}>Discord:</span>
                    <span className={styles.profileValue}>{userProfiles.discord_id}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(userProfiles.discord_id)}
                      className={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                )}
                {userProfiles?.valorant_id && (
                  <div className={styles.profileItem}>
                    <SiValorant />
                    <span className={styles.profileLabel}>Valorant:</span>
                    <span className={styles.profileValue}>{userProfiles.valorant_id}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(userProfiles.valorant_id)}
                      className={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                )}
                {userProfiles?.fortnite_name && (
                  <div className={styles.profileItem}>
                    <FaGamepad />
                    <span className={styles.profileLabel}>Fortnite:</span>
                    <span className={styles.profileValue}>{userProfiles.fortnite_name}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(userProfiles.fortnite_name)}
                      className={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                )}
                {userProfiles?.battlenet_id && (
                  <div className={styles.profileItem}>
                    <SiBattledotnet />
                    <span className={styles.profileLabel}>Battle.net:</span>
                    <span className={styles.profileValue}>{userProfiles.battlenet_id}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(userProfiles.battlenet_id)}
                      className={styles.copyButton}
                    >
                      Copy
                    </button>
                  </div>
                )}
                {!userProfiles?.discord_id && 
                 !userProfiles?.valorant_id && 
                 !userProfiles?.fortnite_name && 
                 !userProfiles?.battlenet_id && (
                  <div className={styles.noProfiles}>
                    {isOwner ? 'Add your gaming profiles to help others find you!' : 'No gaming profiles added yet.'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.clipsGrid}>
            {clips.length === 0 ? (
              <div className={styles.noClips}>
                <p>No clips available</p>
              </div>
            ) : (
              <>
                {clips.map((clip) => (
                  <div key={clip.id} className={styles.clipCard}>
                    <div 
                      className={styles.clipContainer}
                      onClick={() => router.push(`/clip/${clip.id}`)}
                    >
                      <div className={styles.clipHeader}>
                        <h3>{clip.title || 'Untitled Clip'}</h3>
                        {clip.game && (
                          <span className={styles.gameTag}>
                            <FaGamepad />
                            {clip.game}
                          </span>
                        )}
                      </div>

                      <div className={styles.videoWrapper}>
                        <video 
                          className={styles.clipVideo}
                          preload="metadata"
                          muted
                          poster={clip.thumbnailUrl}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <source src={clip.url} type="video/mp4" />
                        </video>
                      </div>

                      <div className={styles.clipActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(clip.id);
                          }}
                          className={`${styles.likeButton} ${likedClips[clip.id] ? styles.liked : ''}`}
                        >
                          {likedClips[clip.id] ? <MdFavorite /> : <MdFavoriteBorder />}
                          <span>{clip.likes_count || 0}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(clip);
                          }}
                          className={styles.actionButton}
                          title={copiedClipId === clip.id ? 'Copied!' : 'Share'}
                        >
                          <MdShare />
                        </button>

                        {isOwner && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility(clip);
                              }}
                              className={styles.actionButton}
                              title={clip.visibility === 'public' ? 'Make Private' : 'Make Public'}
                            >
                              {clip.visibility === 'public' ? <AiOutlineEye /> : <AiOutlineEyeInvisible />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteClip(clip);
                              }}
                              className={`${styles.actionButton} ${styles.deleteButton}`}
                              title="Delete Clip"
                            >
                              <AiOutlineDelete />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Load More Button */}
                {hasMore && !loading && (
                  <div className={styles.loadMoreContainer}>
                    <button 
                      onClick={handleLoadMore} 
                      className={styles.loadMoreButton}
                    >
                      Load More
                    </button>
                  </div>
                )}
                
                {/* Loading indicator */}
                {loading && (
                  <div className={styles.loadingMore}>
                    Loading more clips...
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      )}
    </ProtectedPageWrapper>
  );
} 