import React, { useState, useEffect } from 'react';
import { 
  FaGamepad, FaDiscord, FaTrophy, FaCalendarCheck, 
  FaChevronDown, FaChevronUp, FaCopy, FaUser, FaExternalLinkAlt
} from 'react-icons/fa';
import { IoMdPodium } from 'react-icons/io';
import { SiValorant, SiBattledotnet, SiEpicgames } from 'react-icons/si';
import { AiOutlineCamera, AiOutlineEdit, AiOutlineSave, AiOutlineClose, AiOutlineTrophy } from 'react-icons/ai';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { createClient } from '../../utils/supabase/component';
import { useRouter } from 'next/router';
import { fetchUserPicture, cleanupBlobUrls, uploadUserPicture } from '../../utils/api';
import ProfilePicture from '../shared/ProfilePicture';
import { useAuth } from '../../contexts/AuthContext';
import { updateGamingProfiles } from '../../utils/api';
import TournamentWinner from '../shared/TournamentWinner';
import styles from '../../styles/ProfileDashboard.module.css';

const ProfileDashboard = ({ user, profiles, achievements, isOwner }) => {
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [profilesExpanded, setProfilesExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const [gamingProfiles, setGamingProfiles] = useState(profiles || {});
  const [winCount, setWinCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const { refreshUserData } = useAuth();
  
  // Check if user is new (just created account)
  useEffect(() => {
    const isNewUser = router.query.newUser === 'true';
    if (isNewUser) {
      toast.success(`Welcome to MerrouchGaming, ${user?.username}!`, {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
        duration: 5000
      });
    }
  }, [router.query, user?.username]);
  
  // Add this helper function to split/parse Valorant IDs
  const splitValorantId = (fullId) => {
    if (!fullId) return { name: '', tag: '' };
    const parts = fullId.split('#');
    return {
      name: parts[0] || '',
      tag: parts.length > 1 ? parts[1] : ''
    };
  };

  // Parse the valorant ID into name and tag parts
  const valorantParts = splitValorantId(profiles?.valorant_id);

  // State for edited profiles
  const [editedProfiles, setEditedProfiles] = useState({
    discord_id: profiles?.discord_id || '',
    valorant_name: valorantParts.name,
    valorant_tag: valorantParts.tag,
    fortnite_name: profiles?.fortnite_name || '',
    battlenet_id: profiles?.battlenet_id || ''
  });

  useEffect(() => {
    // Count winning achievements
    if (achievements && Array.isArray(achievements)) {
      setWinCount(achievements.filter(a => a.isWinner).length);
    }
  }, [achievements]);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, {
      position: 'top-right',
      style: {
        background: '#333',
        color: '#fff',
        border: '1px solid #FFD700',
      },
      iconTheme: {
        primary: '#FFD700',
        secondary: '#333',
      },
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedProfiles(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfiles = async () => {
    try {
      // Make sure we have the complete Valorant ID
      let valorantId = editedProfiles.valorant_id;
      
      // If valorant_name exists but tag is empty, don't add the #
      if (editedProfiles.valorant_name && !editedProfiles.valorant_tag) {
        valorantId = editedProfiles.valorant_name;
      } 
      // If both name and tag exist, format properly
      else if (editedProfiles.valorant_name && editedProfiles.valorant_tag) {
        valorantId = `${editedProfiles.valorant_name}#${editedProfiles.valorant_tag}`;
      } 
      // Neither exists, empty string
      else {
        valorantId = '';
      }
      
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({
          discord_id: editedProfiles.discord_id,
          valorant_id: valorantId,
          fortnite_name: editedProfiles.fortnite_name,
          battlenet_id: editedProfiles.battlenet_id,
        })
        .eq('id', profiles.user_id);

      if (error) throw error;

      toast.success('Gaming profiles updated!', {
        position: 'top-right',
        style: {
          background: '#333',
          color: '#fff',
          border: '1px solid #FFD700',
        },
        iconTheme: {
          primary: '#FFD700',
          secondary: '#333',
        },
      });

      setIsEditing(false);
      router.reload();
    } catch (error) {
      console.error('Error updating profiles:', error);
      toast.error('Failed to update profiles', {
        position: 'top-right'
      });
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString('en-US', { 
        year: '2-digit', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return "";
    }
  };

  // Sort achievements: first winners, then by date (newest first)
  const sortedAchievements = achievements ? [...achievements].sort((a, b) => {
    // Winners first
    if (a.isWinner && !b.isWinner) return -1;
    if (!a.isWinner && b.isWinner) return 1;
    
    // Then by date (newest first)
    try {
      return new Date(b.eventDate) - new Date(a.eventDate);
    } catch (error) {
      return 0;
    }
  }) : [];

  return (
    <div className={styles['dashboard-container']}>
      {/* User Profile Summary Section */}
      <div className={styles['user-profile-section']}>
        <div className={styles['user-avatar']}>
          <ProfilePicture 
            userId={user.gizmo_id} 
            username={user.username}
            isOwner={isOwner}
            size={100}
          />
        </div>
        
        <div className={styles['user-info']}>
          <div className={styles['username-container']}>
            <h1 className={`${styles['user-name']} ${user?.username && user.username.length > 15 ? styles['extremely-long-username'] : ''}`}>
              {user?.username || 'User'}
            </h1>
          </div>
          {winCount > 0 && (
            <div className={styles['user-badge']}>
              <FaTrophy style={{ color: '#FFD700', marginRight: '8px' }} />
              <span>{winCount} Tournament {winCount === 1 ? 'Win' : 'Wins'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Gaming Profiles Section */}
      <div className={`${styles['dashboard-section']} ${profilesExpanded ? styles['expanded'] : ''}`}>
        <button 
          className={styles['dashboard-section-header']}
          onClick={() => setProfilesExpanded(!profilesExpanded)}
          style={{ cursor: 'pointer', border: 'none', width: '100%' }}
        >
          <FaGamepad className={styles['dashboard-section-icon']} />
          <h3 className={styles['dashboard-section-title']}>Game Accounts</h3>
          <div className={styles['dashboard-section-actions']}>
            <span className={styles['dashboard-toggle-icon']}>
              {profilesExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </div>
        </button>
        
        <div className={`${styles['dashboard-section-content']} ${profilesExpanded ? styles['expanded'] : ''}`}>
          {isOwner && profilesExpanded && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              padding: '10px 15px 12px', 
              borderBottom: '1px solid #222',
              marginTop: '-5px'
            }}>
              <button 
                onClick={() => {
                  if (isEditing) {
                    handleSaveProfiles();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className={isEditing ? styles['save-button'] : styles['edit-button']}
                style={{ 
                  margin: '0 auto',
                  paddingTop: '4px',
                  paddingBottom: '4px'
                }}
              >
                {isEditing ? 'Save' : 'Edit Profiles'}
              </button>
            </div>
          )}
          
          {isEditing ? (
            <div className={styles['gaming-profile-grid']}>
              <div className={styles['gaming-profile-input']}>
                <FaDiscord className={styles['gaming-profile-icon']} />
                <input
                  type="text"
                  value={editedProfiles.discord_id}
                  onChange={(e) => setEditedProfiles(prev => ({
                    ...prev,
                    discord_id: e.target.value
                  }))}
                  placeholder="Discord ID"
                />
              </div>
              <div className={styles['gaming-profile-input']}>
                <SiValorant className={styles['gaming-profile-icon']} />
                <div className={styles['valorant-input-group']}>
                  <input
                    type="text"
                    value={editedProfiles.valorant_name}
                    onChange={(e) => setEditedProfiles(prev => {
                      const newName = e.target.value;
                      const newId = newName && prev.valorant_tag 
                        ? `${newName}#${prev.valorant_tag}` 
                        : newName;
                      return {
                        ...prev,
                        valorant_name: newName,
                        valorant_id: newId
                      };
                    })}
                    placeholder="Username"
                    className={styles['valorant-name-input']}
                  />
                  <span className={styles['hash-separator']}>
                    #
                  </span>
                  <input
                    type="text"
                    value={editedProfiles.valorant_tag}
                    onChange={(e) => setEditedProfiles(prev => {
                      const newTag = e.target.value;
                      const newId = prev.valorant_name
                        ? (newTag ? `${prev.valorant_name}#${newTag}` : prev.valorant_name)
                        : '';
                      return {
                        ...prev,
                        valorant_tag: newTag,
                        valorant_id: newId
                      };
                    })}
                    placeholder="Tag"
                    className={styles['valorant-tag-input']}
                  />
                </div>
              </div>
              <div className={styles['gaming-profile-input']}>
                <SiEpicgames className={styles['gaming-profile-icon']} />
                <input
                  type="text"
                  value={editedProfiles.fortnite_name}
                  onChange={(e) => setEditedProfiles(prev => ({
                    ...prev,
                    fortnite_name: e.target.value
                  }))}
                  placeholder="Fortnite Name"
                />
              </div>
              <div className={styles['gaming-profile-input']}>
                <SiBattledotnet className={styles['gaming-profile-icon']} />
                <input
                  type="text"
                  value={editedProfiles.battlenet_id}
                  onChange={(e) => setEditedProfiles(prev => ({
                    ...prev,
                    battlenet_id: e.target.value
                  }))}
                  placeholder="Battle.net ID"
                />
              </div>
            </div>
          ) : (
            <div className={styles['gaming-profile-grid']}>
              {profiles?.discord_id && (
                <div className={styles['gaming-profile-item']} onClick={() => handleCopy(profiles.discord_id, 'Discord ID')}>
                  <FaDiscord className={styles['gaming-profile-icon']} />
                  <span className={styles['gaming-profile-text']}>{profiles.discord_id}</span>
                  <FaCopy className={styles['gaming-profile-copy']} />
                </div>
              )}
              {profiles?.valorant_id && (
                <div className={styles['gaming-profile-item']} onClick={() => handleCopy(profiles.valorant_id, 'Valorant ID')}>
                  <SiValorant className={styles['gaming-profile-icon']} />
                  <span className={styles['gaming-profile-text']}>
                    {valorantParts.name}
                    {valorantParts.tag && (
                      <>
                        <span style={{ color: '#888', margin: '0 1px' }}>#</span>
                        {valorantParts.tag}
                      </>
                    )}
                  </span>
                  <FaCopy className={styles['gaming-profile-copy']} />
                </div>
              )}
              {profiles?.fortnite_name && (
                <div className={styles['gaming-profile-item']} onClick={() => handleCopy(profiles.fortnite_name, 'Fortnite Name')}>
                  <SiEpicgames className={styles['gaming-profile-icon']} />
                  <span className={styles['gaming-profile-text']}>{profiles.fortnite_name}</span>
                  <FaCopy className={styles['gaming-profile-copy']} />
                </div>
              )}
              {profiles?.battlenet_id && (
                <div className={styles['gaming-profile-item']} onClick={() => handleCopy(profiles.battlenet_id, 'Battle.net ID')}>
                  <SiBattledotnet className={styles['gaming-profile-icon']} />
                  <span className={styles['gaming-profile-text']}>{profiles.battlenet_id}</span>
                  <FaCopy className={styles['gaming-profile-copy']} />
                </div>
              )}
              {!profiles?.discord_id && 
               !profiles?.valorant_id && 
               !profiles?.fortnite_name && 
               !profiles?.battlenet_id && (
                <div className={styles['no-profiles-message']}>
                  {isOwner ? 'Add your gaming profiles!' : 'No gaming profiles added yet.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Participation Section */}
      {achievements && achievements.length > 0 && (
        <div className={`${styles['dashboard-section']} ${eventsExpanded ? styles['expanded'] : ''}`}>
          <button 
            className={styles['dashboard-section-header']}
            onClick={() => setEventsExpanded(!eventsExpanded)}
            style={{ cursor: 'pointer', border: 'none', width: '100%' }}
          >
            <IoMdPodium className={styles['dashboard-section-icon']} />
            <div className={styles['dashboard-title-container']}>
              <h3 className={styles['dashboard-section-title']}>Events Played ({achievements.length})</h3>
              {winCount > 0 && <span className={`${styles['section-badge']} ${styles['section-badge-mobile']}`}>{winCount} {winCount === 1 ? 'win' : 'wins'}</span>}
            </div>
            <div className={styles['dashboard-section-actions']}>
              {winCount > 0 && <span className={`${styles['section-badge']} ${styles['section-badge-desktop']}`}>{winCount} {winCount === 1 ? 'win' : 'wins'}</span>}
              <span className={styles['dashboard-toggle-icon']}>
                {eventsExpanded ? <FaChevronUp /> : <FaChevronDown />}
              </span>
            </div>
          </button>
          
          <div className={`${styles['dashboard-section-content']} ${eventsExpanded ? styles['expanded'] : ''}`}>
            {sortedAchievements.map((achievement) => (
              <div key={achievement.eventId} className={styles['event-item']}>
                <div className={styles['event-icon']}>
                  {achievement.isWinner ? (
                    <FaTrophy style={{ color: '#FFD700', fontSize: '18px' }} title="Tournament Winner" />
                  ) : (
                    <IoMdPodium style={{ color: '#8A2BE2', fontSize: '18px' }} />
                  )}
                </div>
                
                <div className={styles['event-details']}>
                  <div className={styles['event-header']}>
                    <h4 className={styles['event-title']}>
                      {achievement.eventTitle || "Unnamed Event"}
                    </h4>
                    {achievement.isWinner && (
                      <TournamentWinner 
                        winner={{ username: user?.username }} 
                        showBadgeOnly={true} 
                      />
                    )}
                  </div>
                  
                  <div className={styles['event-meta']}>
                    {achievement.game || "Gaming Event"}
                    {achievement.teamType !== 'solo' && achievement.partners && achievement.partners.length > 0 && (
                      <span style={{ color: '#9D4EDD', fontSize: '13px', marginLeft: '8px' }}>
                        • With: {' '}
                        <span style={{ marginLeft: '5px' }}>
                        {achievement.partners.map((partner, index) => (
                          <React.Fragment key={partner.userId || index}>
                            <Link 
                              href={`/profile/${partner.username}`}
                              style={{ 
                                color: '#FFD700',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease'
                              }}
                              className="partner-username"
                            >
                                {partner.username}{partner.isTeamLeader ? ' (Team Leader)' : ''}
                            </Link>
                            {index < achievement.partners.length - 1 ? ', ' : ''}
                          </React.Fragment>
                        ))}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className={styles['event-date']}>
                    {formatDate(achievement.eventDate)}
                  </div>
                  <Link 
                    href={`/events/${achievement.eventId}`}
                    className={styles['view-event-button']}
                  >
                    View Event
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDashboard; 