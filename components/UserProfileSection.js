import { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import { FaDiscord, FaGamepad } from 'react-icons/fa';
import { SiValorant, SiBattledotnet, SiEpicgames } from 'react-icons/si';
import { AiOutlineUser, AiOutlineCopy } from 'react-icons/ai';
// import { MdCloudUpload } from 'react-icons/md'; // Removed unused import
// import { useRouter } from 'next/router'; // Removed unused import
import { fetchUserPicture, cleanupBlobUrls } from '../utils/api';
import styles from '../styles/Profile.module.css';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '../utils/supabase/component';

const UserProfileSection = memo(({ username, isOwner, supabase }) => {
  // const router = useRouter(); // Removed unused variable
  const { isLoggedIn } = useAuth();
  const [userPicture, setUserPicture] = useState(null);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [isEditingProfiles, setIsEditingProfiles] = useState(false);
  const [userProfiles, setUserProfiles] = useState(null);
  const [editedProfiles, setEditedProfiles] = useState({
    discord_id: '',
    valorant_id: '',
    fortnite_name: '',
    battlenet_id: ''
  });

  // Reset editing state when auth state changes
  useEffect(() => {
    if (!isLoggedIn) {
      console.log('User logged out, resetting edit state');
      setIsEditingProfiles(false);
    }
  }, [isLoggedIn]);

  // Subscribe to real-time profile changes
  useEffect(() => {
    if (!username) return;

    const supabase = createClient();
    
    const subscription = supabase
      .channel(`profile-${username}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `username=eq.${username}`
        },
        (payload) => {
          console.log('Profile update:', payload);
          if (payload.new) {
            setUserProfiles(payload.new);
            setEditedProfiles(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [username]);

  // Fetch user picture using gizmo_id from users table
  useEffect(() => {
    let mounted = true;
    
    const fetchProfilePicture = async () => {
      setPictureLoading(true);
      try {
        // Get gizmo_id directly from users table
        const { data: userData, error } = await supabase
          .from('users')
          .select('gizmo_id')
          .eq('username', username)
          .single();

        if (error) throw error;
        
        console.log('User data from DB:', userData); // Debug log

        if (userData?.gizmo_id && mounted) {
          const pictureUrl = await fetchUserPicture(userData.gizmo_id);
          console.log('Fetched pictureUrl:', pictureUrl); // Debug log
          
          if (mounted && pictureUrl) {
            setUserPicture(pictureUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      } finally {
        if (mounted) setPictureLoading(false);
      }
    };

    if (username) {
      fetchProfilePicture();
    }

    return () => {
      mounted = false;
      cleanupBlobUrls();
    };
  }, [username, supabase]);

  // Fetch user profiles
  useEffect(() => {
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

    if (username) {
      fetchUserProfiles();
    }
  }, [username, supabase]);

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

  return (
    <div className={styles.profileHeader}>
      <div className={styles.profileTop}>
        <div className={styles.profileInfo}>
          <div className={styles.profileImageContainer}>
            {pictureLoading ? (
              <div className={styles.profileImageLoading}>
                <div className={styles.spinner}></div>
              </div>
            ) : userPicture ? (
              <Image 
                src={userPicture}
                alt={`${username}'s profile`}
                className={styles.profileImage}
                width={120}
                height={120}
              />
            ) : (
              <div className={styles.profileImagePlaceholder}>
                <AiOutlineUser className={styles.placeholderIcon} />
              </div>
            )}
          </div>
          <div className={styles.profileDetails}>
            <h1>{username}&#39;s Profile</h1>
          </div>
        </div>
      </div>

      <div className={styles.profileContent}>
        <div className={styles.profileGrid}>
          {/* Gaming Profiles Section */}
          <div className={styles.gamingProfiles}>
            <div className={styles.profilesHeader}>
              <FaGamepad className={styles.headerIcon} />
              <h3>Gaming Profiles</h3>
              {isOwner && isLoggedIn && (
                <button 
                  onClick={() => {
                    if (isEditingProfiles) {
                      handleProfileUpdate();
                    }
                    setIsEditingProfiles(!isEditingProfiles);
                  }}
                  className={styles.editButton}
                >
                  {isEditingProfiles ? 'Save' : 'Edit'}
                </button>
              )}
            </div>

            {isEditingProfiles && isLoggedIn ? (
              <div className={styles.profilesEditGrid}>
                <div className={styles.profileInput}>
                  <FaDiscord className={styles.profileIcon} />
                  <input
                    type="text"
                    value={editedProfiles.discord_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      discord_id: e.target.value
                    }))}
                    placeholder="Discord ID"
                  />
                </div>
                <div className={styles.profileInput}>
                  <SiValorant className={styles.profileIcon} />
                  <input
                    type="text"
                    value={editedProfiles.valorant_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      valorant_id: e.target.value
                    }))}
                    placeholder="Valorant ID"
                  />
                </div>
                <div className={styles.profileInput}>
                  <SiEpicgames className={styles.profileIcon} />
                  <input
                    type="text"
                    value={editedProfiles.fortnite_name || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      fortnite_name: e.target.value
                    }))}
                    placeholder="Fortnite Name"
                  />
                </div>
                <div className={styles.profileInput}>
                  <SiBattledotnet className={styles.profileIcon} />
                  <input
                    type="text"
                    value={editedProfiles.battlenet_id || ''}
                    onChange={(e) => setEditedProfiles(prev => ({
                      ...prev,
                      battlenet_id: e.target.value
                    }))}
                    placeholder="Battle.net ID"
                  />
                </div>
              </div>
            ) : (
              <div className={styles.profilesDisplayGrid}>
                {userProfiles?.discord_id && (
                  <div className={styles.profileItem}>
                    <FaDiscord className={styles.profileIcon} />
                    <span>{userProfiles.discord_id}</span>
                    {isLoggedIn && (
                      <button onClick={() => navigator.clipboard.writeText(userProfiles.discord_id)}>
                        <AiOutlineCopy /> Copy
                      </button>
                    )}
                  </div>
                )}
                {userProfiles?.valorant_id && (
                  <div className={styles.profileItem}>
                    <SiValorant className={styles.profileIcon} />
                    <span>{userProfiles.valorant_id}</span>
                    {isLoggedIn && (
                      <button onClick={() => navigator.clipboard.writeText(userProfiles.valorant_id)}>
                        <AiOutlineCopy /> Copy
                      </button>
                    )}
                  </div>
                )}
                {userProfiles?.fortnite_name && (
                  <div className={styles.profileItem}>
                    <SiEpicgames className={styles.profileIcon} />
                    <span>{userProfiles.fortnite_name}</span>
                    {isLoggedIn && (
                      <button onClick={() => navigator.clipboard.writeText(userProfiles.fortnite_name)}>
                        <AiOutlineCopy /> Copy
                      </button>
                    )}
                  </div>
                )}
                {userProfiles?.battlenet_id && (
                  <div className={styles.profileItem}>
                    <SiBattledotnet className={styles.profileIcon} />
                    <span>{userProfiles.battlenet_id}</span>
                    {isLoggedIn && (
                      <button onClick={() => navigator.clipboard.writeText(userProfiles.battlenet_id)}>
                        <AiOutlineCopy /> Copy
                      </button>
                    )}
                  </div>
                )}
                {!userProfiles?.discord_id && 
                 !userProfiles?.valorant_id && 
                 !userProfiles?.fortnite_name && 
                 !userProfiles?.battlenet_id && (
                  <div className={styles.noProfiles}>
                    {isOwner && isLoggedIn ? (
                      'Add your gaming profiles!'
                    ) : (
                      'No gaming profiles added yet.'
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

UserProfileSection.displayName = 'UserProfileSection';

export default UserProfileSection; 