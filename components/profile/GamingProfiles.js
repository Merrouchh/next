import React, { useState } from 'react';
import { FaDiscord, FaGamepad, FaCopy } from 'react-icons/fa';
import { SiValorant, SiBattledotnet, SiEpicgames } from 'react-icons/si';
import { AiOutlineCopy } from 'react-icons/ai';
import styles from '../../styles/Profile.module.css';
import { createClient } from '../../utils/supabase/component';
import toast from 'react-hot-toast';
import { useRouter } from 'next/router';

// For gaming IDs (Discord, Valorant, etc.)
const GamingProfiles = ({ profiles, isOwner, onCopy }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfiles, setEditedProfiles] = useState({
    discord_id: profiles?.discord_id || '',
    valorant_id: profiles?.valorant_id || '',
    fortnite_name: profiles?.fortnite_name || '',
    battlenet_id: profiles?.battlenet_id || ''
  });
  const router = useRouter();

  const handleSave = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({
          discord_id: editedProfiles.discord_id,
          valorant_id: editedProfiles.valorant_id,
          fortnite_name: editedProfiles.fortnite_name,
          battlenet_id: editedProfiles.battlenet_id,
        })
        .eq('id', profiles.user_id);

      if (error) throw error;

      toast.success('Gaming profiles updated successfully!', {
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

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={styles.gamingProfiles}>
      <div className={styles.profilesHeader}>
        <FaGamepad className={styles.headerIcon} />
        <h3>Gaming Profiles</h3>
        {isOwner && (
          <button 
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            className={styles.editButton}
          >
            {isEditing ? 'Save' : 'Edit'}
          </button>
        )}
      </div>

      <div className={styles.profilesContent}>
        {isEditing ? (
          <div className={styles.profilesEditGrid}>
            <div className={styles.profileInput}>
              <FaDiscord className={styles.profileIcon} />
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
            <div className={styles.profileInput}>
              <SiValorant className={styles.profileIcon} />
              <input
                type="text"
                value={editedProfiles.valorant_id}
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
                value={editedProfiles.fortnite_name}
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
          <div className={styles.profilesDisplayGrid}>
            {profiles?.discord_id && (
              <div className={styles.profileItem} onClick={() => onCopy(profiles.discord_id, 'Discord ID')}>
                <FaDiscord className={styles.profileIcon} />
                <span>{profiles.discord_id}</span>
                <FaCopy className={styles.copyIcon} />
              </div>
            )}
            {profiles?.valorant_id && (
              <div className={styles.profileItem} onClick={() => onCopy(profiles.valorant_id, 'Valorant ID')}>
                <SiValorant className={styles.profileIcon} />
                <span>{profiles.valorant_id}</span>
                <FaCopy className={styles.copyIcon} />
              </div>
            )}
            {profiles?.fortnite_name && (
              <div className={styles.profileItem} onClick={() => onCopy(profiles.fortnite_name, 'Fortnite Name')}>
                <SiEpicgames className={styles.profileIcon} />
                <span>{profiles.fortnite_name}</span>
                <FaCopy className={styles.copyIcon} />
              </div>
            )}
            {profiles?.battlenet_id && (
              <div className={styles.profileItem} onClick={() => onCopy(profiles.battlenet_id, 'Battle.net ID')}>
                <SiBattledotnet className={styles.profileIcon} />
                <span>{profiles.battlenet_id}</span>
                <FaCopy className={styles.copyIcon} />
              </div>
            )}
            {!profiles?.discord_id && 
             !profiles?.valorant_id && 
             !profiles?.fortnite_name && 
             !profiles?.battlenet_id && (
              <div className={styles.noProfiles}>
                {isOwner ? 'Add your gaming profiles!' : 'No gaming profiles added yet.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamingProfiles; 