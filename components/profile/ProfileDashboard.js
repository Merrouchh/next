import React, { useState, useEffect } from 'react';
import { 
  FaGamepad, FaDiscord, FaTrophy, FaCalendarCheck, 
  FaChevronDown, FaChevronUp, FaCopy, FaUser, FaExternalLinkAlt 
} from 'react-icons/fa';
import { IoMdPodium } from 'react-icons/io';
import { SiValorant, SiBattledotnet, SiEpicgames } from 'react-icons/si';
import { AiOutlineCamera } from 'react-icons/ai';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { createClient } from '../../utils/supabase/component';
import { useRouter } from 'next/router';
import { fetchUserPicture, cleanupBlobUrls, uploadUserPicture } from '../../utils/api';

const ProfileDashboard = ({ user, profiles, achievements, isOwner }) => {
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [profilesExpanded, setProfilesExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const [pictureUrl, setPictureUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Add this helper function to split/parse Valorant IDs
  const parseValorantId = (valorantId) => {
    if (!valorantId) return { name: '', tag: '' };
    const parts = valorantId.split('#');
    return {
      name: parts[0] || '',
      tag: parts[1] || ''
    };
  };

  // Update state to handle Valorant username and tag separately
  const [editedProfiles, setEditedProfiles] = useState({
    discord_id: profiles?.discord_id || '',
    valorant_id: profiles?.valorant_id || '',
    valorant_name: parseValorantId(profiles?.valorant_id).name,
    valorant_tag: parseValorantId(profiles?.valorant_id).tag,
    fortnite_name: profiles?.fortnite_name || '',
    battlenet_id: profiles?.battlenet_id || ''
  });

  // Count the number of wins
  const winCount = achievements ? achievements.filter(a => a.isWinner).length : 0;

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

  useEffect(() => {
    let mounted = true;

    const loadProfilePicture = async () => {
      if (!user?.gizmo_id) {
        return;
      }

      try {
        setLoading(true);
        const url = await fetchUserPicture(user.gizmo_id);
        if (mounted) {
          setPictureUrl(url);
        }
      } catch (error) {
        // Ignore error - will show placeholder
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfilePicture();

    return () => {
      mounted = false;
      cleanupBlobUrls();
    };
  }, [user?.gizmo_id]);

  const handlePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setLoading(true);
      const success = await uploadUserPicture(user.gizmo_id, file);

      if (success) {
        const newPicture = await fetchUserPicture(user.gizmo_id);
        setPictureUrl(newPicture);
      } else {
        throw new Error('Failed to upload picture');
      }
    } catch (error) {
      console.error('Error uploading picture:', error);
      alert('Failed to upload picture. Please try again.');
    } finally {
      setLoading(false);
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
      // If neither exists, empty string
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

  return (
    <>
      <style jsx global>{`
        .dashboard-section {
          background-color: #0e0e0e;
          border-radius: 8px;
          margin: 0 0 12px;
          overflow: hidden;
          border: 1px solid #222;
          transition: margin 0.3s ease;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .dashboard-section.expanded {
          margin-bottom: 12px;
        }
        
        .dashboard-section-header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 15px;
          position: relative;
          background-color: #0e0e0e;
          border-bottom: 1px solid transparent;
          text-align: center;
        }
        
        .dashboard-section-title {
          margin: 0;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-size: 16px;
          color: #fff;
        }
        
        .dashboard-section-icon {
          color: #FFD700;
          font-size: 22px;
          margin-right: 12px;
        }
        
        .dashboard-section-actions {
          position: absolute;
          right: 15px;
          display: flex;
          align-items: center;
        }
        
        .dashboard-toggle-icon {
          color: #FFD700;
          display: flex;
          align-items: center;
          font-size: 14px;
        }
        
        .dashboard-section-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.2s ease;
        }
        
        .dashboard-section-content.expanded {
          max-height: 2000px;
        }
        
        .user-profile-section {
          display: flex;
          padding: 20px;
          align-items: center;
          background-color: #0e0e0e;
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid #222;
        }
        
        .user-avatar {
          border-radius: 50%;
          overflow: hidden;
          background-color: #1a1a1a;
          border: 2px solid #FFD700;
          position: relative;
          width: 80px;
          height: 80px;
        }
        
        .upload-button-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: rgba(0, 0, 0, 0.6);
          color: #FFD700;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .user-avatar:hover .upload-button-overlay {
          opacity: 1;
        }
        
        .hidden-input {
          display: none;
        }
        
        .user-info {
          margin-left: 20px;
          flex: 1;
        }
        
        .user-name {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 5px;
          color: #fff;
        }
        
        .user-stats {
          display: flex;
          gap: 15px;
          margin-top: 5px;
        }
        
        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .stat-value {
          font-weight: 600;
          color: #FFD700;
        }
        
        .stat-label {
          color: #888;
          font-size: 14px;
        }
        
        .gaming-profile-grid {
          display: grid;
          gap: 1px;
          background-color: #111;
        }
        
        .gaming-profile-item {
          display: flex;
          align-items: center;
          padding: 12px 15px;
          background-color: #0e0e0e;
          cursor: pointer;
        }
        
        .gaming-profile-item:hover {
          background-color: #171717;
        }
        
        .gaming-profile-icon {
          color: #FFD700;
          font-size: 18px;
          margin-right: 12px;
          flex-shrink: 0;
        }
        
        .gaming-profile-text {
          flex: 1;
          color: #fff;
          font-size: 14px;
        }
        
        .gaming-profile-copy {
          color: #555;
          margin-left: 10px;
        }
        
        .gaming-profile-item:hover .gaming-profile-copy {
          color: #FFD700;
        }
        
        .no-profiles-message {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        
        .gaming-profile-input {
          display: flex;
          align-items: center;
          padding: 12px 15px;
          background-color: #0e0e0e;
          border-bottom: 1px solid #222;
        }
        
        .valorant-input-group {
          display: flex;
          align-items: center;
          flex: 1;
          max-width: 300px;
        }
        
        .valorant-name-input {
          flex-grow: 1;
          flex-shrink: 1;
          min-width: 100px;
          max-width: 200px;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 14px;
          padding: 0;
        }
        
        .valorant-tag-input {
          width: 50px;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 14px;
          padding: 0;
        }
        
        .hash-separator {
          color: #888;
          margin: 0 1px;
          user-select: none;
          font-weight: bold;
        }
        
        .event-item {
          display: flex;
          align-items: center;
          padding: 12px 15px;
          border-bottom: 1px solid #222;
          color: #fff;
        }
        
        .event-icon {
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }
        
        .event-details {
          flex: 1;
          min-width: 0;
        }
        
        .event-header {
          display: flex;
          align-items: center;
        }
        
        .event-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .winner-badge {
          background-color: #FFD700;
          color: #111;
          font-size: 10px;
          padding: 1px 5px;
          border-radius: 3px;
          margin-left: 8px;
          font-weight: 700;
          letter-spacing: 0.2px;
          text-transform: uppercase;
        }
        
        .event-meta {
          font-size: 14px;
          color: #888;
          margin-top: 3px;
        }
        
        .event-date {
          font-size: 13px;
          color: #777;
          margin-left: 10px;
          text-align: right;
          flex-shrink: 0;
        }
        
        .section-badge {
          background-color: rgba(255, 215, 0, 0.15);
          color: #FFD700;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          margin-right: 12px;
        }
        
        .edit-button {
          background-color: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.3);
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-right: 10px;
        }
        
        .edit-button:hover {
          background-color: rgba(255, 215, 0, 0.2);
        }
        
        .save-button {
          background-color: #FFD700;
          color: #111;
          border: none;
          padding: 3px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-right: 10px;
          font-weight: 600;
        }
        
        .save-button:hover {
          background-color: #ffc800;
        }
        
        .no-events-message {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 14px;
        }
        
        .external-link-icon {
          margin-left: 8px;
          font-size: 12px;
          opacity: 0.6;
        }
        
        .event-item:hover .external-link-icon {
          opacity: 1;
        }
        
        .view-event-button {
          background-color: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border: 1px solid rgba(255, 215, 0, 0.3);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
          transition: background-color 0.2s;
        }
        
        .view-event-button:hover {
          background-color: rgba(255, 215, 0, 0.2);
        }
      `}</style>

      {/* User Profile Summary Section */}
      <div className="user-profile-section">
        <div className="user-avatar">
          {loading ? (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#666'
            }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #FFD700', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : pictureUrl ? (
            <Image 
              src={pictureUrl} 
              alt={user.username || 'User'} 
              width={80} 
              height={80}
              objectFit="cover"
              onError={() => setPictureUrl(null)}
            />
          ) : (
            <div style={{ 
              width: '100%', 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#666'
            }}>
              <FaUser size={30} />
            </div>
          )}
          
          {isOwner && !loading && (
            <label className="upload-button-overlay">
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                className="hidden-input"
              />
              <AiOutlineCamera size={24} />
            </label>
          )}
        </div>
        <div className="user-info">
          <h1 className="user-name">{user?.username || 'User'}</h1>
          <div className="user-stats">
            {user.clips_count > 0 ? (
              <div className="stat-item">
                <FaGamepad style={{ color: '#3a9df1' }} />
                <span className="stat-value">{user.clips_count}</span>
                <span className="stat-label">clips</span>
                {achievements && achievements.length > 0 && (
                  <>
                    <span style={{ color: '#777', margin: '0 4px' }}>•</span>
                    <IoMdPodium style={{ color: '#3a9df1', marginRight: '4px' }} />
                    <span className="stat-value">{achievements.length}</span>
                    <span className="stat-label">events</span>
                  </>
                )}
              </div>
            ) : achievements && achievements.length > 0 && (
              <div className="stat-item">
                <IoMdPodium style={{ color: '#3a9df1' }} />
                <span className="stat-value">{achievements.length}</span>
                <span className="stat-label">events</span>
              </div>
            )}
            {winCount > 0 && (
              <div className="stat-item">
                <FaTrophy style={{ color: '#FFD700' }} />
                <span className="stat-value">{winCount}</span>
                <span className="stat-label">wins</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gaming Profiles Section */}
      <div className={`dashboard-section ${profilesExpanded ? 'expanded' : ''}`}>
        <button 
          className="dashboard-section-header"
          onClick={() => setProfilesExpanded(!profilesExpanded)}
          style={{ cursor: 'pointer', border: 'none', width: '100%' }}
        >
          <FaGamepad className="dashboard-section-icon" />
          <h3 className="dashboard-section-title">Gaming Profiles</h3>
          <div className="dashboard-section-actions">
            {isOwner && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing) {
                    handleSaveProfiles();
                  } else {
                    setIsEditing(true);
                    if (!profilesExpanded) {
                      setProfilesExpanded(true);
                    }
                  }
                }}
                className={isEditing ? "save-button" : "edit-button"}
              >
                {isEditing ? 'Save' : 'Edit'}
              </button>
            )}
            <span className="dashboard-toggle-icon">
              {profilesExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </span>
          </div>
        </button>
        
        <div className={`dashboard-section-content ${profilesExpanded ? 'expanded' : ''}`}>
          {isEditing ? (
            <div className="gaming-profile-grid">
              <div className="gaming-profile-input">
                <FaDiscord className="gaming-profile-icon" />
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
              <div className="gaming-profile-input">
                <SiValorant className="gaming-profile-icon" />
                <div className="valorant-input-group">
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
                    className="valorant-name-input"
                  />
                  <span className="hash-separator">#</span>
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
                    className="valorant-tag-input"
                  />
                </div>
              </div>
              <div className="gaming-profile-input">
                <SiEpicgames className="gaming-profile-icon" />
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
              <div className="gaming-profile-input">
                <SiBattledotnet className="gaming-profile-icon" />
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
            <div className="gaming-profile-grid">
              {profiles?.discord_id && (
                <div className="gaming-profile-item" onClick={() => handleCopy(profiles.discord_id, 'Discord ID')}>
                  <FaDiscord className="gaming-profile-icon" />
                  <span className="gaming-profile-text">{profiles.discord_id}</span>
                  <FaCopy className="gaming-profile-copy" />
                </div>
              )}
              {profiles?.valorant_id && (
                <div className="gaming-profile-item" onClick={() => handleCopy(profiles.valorant_id, 'Valorant ID')}>
                  <SiValorant className="gaming-profile-icon" />
                  <span className="gaming-profile-text">
                    {parseValorantId(profiles.valorant_id).name}
                    {parseValorantId(profiles.valorant_id).tag && (
                      <>
                        <span style={{ color: '#888', margin: '0 1px' }}>#</span>
                        {parseValorantId(profiles.valorant_id).tag}
                      </>
                    )}
                  </span>
                  <FaCopy className="gaming-profile-copy" />
                </div>
              )}
              {profiles?.fortnite_name && (
                <div className="gaming-profile-item" onClick={() => handleCopy(profiles.fortnite_name, 'Fortnite Name')}>
                  <SiEpicgames className="gaming-profile-icon" />
                  <span className="gaming-profile-text">{profiles.fortnite_name}</span>
                  <FaCopy className="gaming-profile-copy" />
                </div>
              )}
              {profiles?.battlenet_id && (
                <div className="gaming-profile-item" onClick={() => handleCopy(profiles.battlenet_id, 'Battle.net ID')}>
                  <SiBattledotnet className="gaming-profile-icon" />
                  <span className="gaming-profile-text">{profiles.battlenet_id}</span>
                  <FaCopy className="gaming-profile-copy" />
                </div>
              )}
              {!profiles?.discord_id && 
               !profiles?.valorant_id && 
               !profiles?.fortnite_name && 
               !profiles?.battlenet_id && (
                <div className="no-profiles-message">
                  {isOwner ? 'Add your gaming profiles!' : 'No gaming profiles added yet.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Participation Section */}
      {achievements && achievements.length > 0 && (
        <div className={`dashboard-section ${eventsExpanded ? 'expanded' : ''}`}>
          <button 
            className="dashboard-section-header"
            onClick={() => setEventsExpanded(!eventsExpanded)}
            style={{ cursor: 'pointer', border: 'none', width: '100%' }}
          >
            <IoMdPodium className="dashboard-section-icon" />
            <h3 className="dashboard-section-title">Event Participation ({achievements.length})</h3>
            <div className="dashboard-section-actions">
              {winCount > 0 && <span className="section-badge">{winCount} wins</span>}
              <span className="dashboard-toggle-icon">
                {eventsExpanded ? <FaChevronUp /> : <FaChevronDown />}
              </span>
            </div>
          </button>
          
          <div className={`dashboard-section-content ${eventsExpanded ? 'expanded' : ''}`}>
            {sortedAchievements.map((achievement) => (
              <div key={achievement.eventId} className="event-item">
                <div className="event-icon">
                  {achievement.isWinner ? (
                    <FaTrophy style={{ color: '#FFD700', fontSize: '18px' }} />
                  ) : (
                    <IoMdPodium style={{ color: '#aaa', fontSize: '18px' }} />
                  )}
                </div>
                
                <div className="event-details">
                  <div className="event-header">
                    <h4 className="event-title">
                      {achievement.eventTitle || "Unnamed Event"}
                    </h4>
                    {achievement.isWinner && (
                      <span className="winner-badge">Winner</span>
                    )}
                  </div>
                  
                  <div className="event-meta">
                    {achievement.game || "Gaming Event"}
                    {achievement.teamType !== 'solo' && achievement.partners && achievement.partners.length > 0 && (
                      <span style={{ color: '#777', fontSize: '13px', marginLeft: '8px' }}>
                        • With: {' '}
                        <span style={{ marginLeft: '5px' }}>
                        {achievement.partners.map((partner, index) => (
                          <React.Fragment key={partner.userId || index}>
                            <span style={{ color: '#FFD700' }}>
                              {partner.username}
                            </span>
                            {index < achievement.partners.length - 1 ? ', ' : ''}
                          </React.Fragment>
                        ))}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="event-date">
                    {formatDate(achievement.eventDate)}
                  </div>
                  <Link 
                    href={`/events/${achievement.eventId}`}
                    className="view-event-button"
                  >
                    View Event
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileDashboard; 