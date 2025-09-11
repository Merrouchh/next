import React, { useState, useEffect, useMemo } from 'react';
import styles from '../../styles/EditProfile.module.css';
import { FaGamepad, FaSave, FaDiscord } from 'react-icons/fa';
import { SiValorant, SiEpicgames, SiBattledotnet } from 'react-icons/si';
import { useAuth } from '../../contexts/AuthContext';

const GamingSection = () => {
  const { user, supabase, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showCustomGameInput, setShowCustomGameInput] = useState(false);
  
  // Form state for all gaming profiles
  const [profiles, setProfiles] = useState({
    favorite_game: '',
    custom_game: '',
    discord_id: '',
    valorant_id: '',
    fortnite_name: '',
    battlenet_id: ''
  });
  
  // Popular game options
  const gameOptions = useMemo(() => [
    'Valorant',
    'League of Legends',
    'FIFA',
    'CS:GO',
    'Fortnite',
    'Call of Duty',
    'PUBG',
    'Apex Legends',
    'Minecraft',
    'Rocket League',
    'Overwatch',
    'Dota 2',
    'Hearthstone',
    'Rainbow Six Siege',
    'Other'
  ], []);

  // Load current profile data
  useEffect(() => {
    console.log('GamingSection useEffect - user changed:', user);
    if (user) {
      // Check if favorite game is in our predefined list
      const isCustomGame = user.favorite_game && !gameOptions.includes(user.favorite_game) && user.favorite_game !== 'Other';
      
      const newProfiles = {
        favorite_game: isCustomGame ? 'Other' : (user.favorite_game || ''),
        custom_game: isCustomGame ? user.favorite_game : '',
        discord_id: user.discord_id || '',
        valorant_id: user.valorant_id || '',
        fortnite_name: user.fortnite_name || '',
        battlenet_id: user.battlenet_id || ''
      };
      
      console.log('Setting profiles from user data:', newProfiles);
      setProfiles(newProfiles);
      
      setShowCustomGameInput(isCustomGame || user.favorite_game === 'Other');
    }
  }, [user, gameOptions]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'favorite_game') {
      setShowCustomGameInput(value === 'Other');
    }
    
    setProfiles(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save gaming profiles
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Determine the actual favorite game value to save
      const favoriteGameToSave = profiles.favorite_game === 'Other' && profiles.custom_game 
        ? profiles.custom_game 
        : profiles.favorite_game;
      
      console.log('Saving gaming profiles:', {
        favorite_game: favoriteGameToSave,
        discord_id: profiles.discord_id,
        valorant_id: profiles.valorant_id,
        fortnite_name: profiles.fortnite_name,
        battlenet_id: profiles.battlenet_id
      });
      
      const { error } = await supabase
        .from('users')
        .update({
          favorite_game: favoriteGameToSave,
          discord_id: profiles.discord_id,
          valorant_id: profiles.valorant_id,
          fortnite_name: profiles.fortnite_name,
          battlenet_id: profiles.battlenet_id
        })
        .eq('id', user.id);

      if (error) throw error;

      console.log('Gaming profiles saved successfully');

      // Show success message
      setMessage({ type: 'success', text: 'Gaming profiles updated successfully!' });
      
      // Refresh user data in context
      if (refreshUserData) {
        console.log('Refreshing user data...');
        await refreshUserData();
        console.log('User data refreshed');
      }
    } catch (error) {
      console.error('Error updating gaming profiles:', error);
      setMessage({ type: 'error', text: 'Failed to update gaming profiles. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Platform colors for styling
  const platformStyles = {
    main: { borderColor: '#FFD700', background: 'rgba(255, 215, 0, 0.05)' },
    discord: { borderColor: '#5865F2', background: 'rgba(88, 101, 242, 0.05)' },
    valorant: { borderColor: '#FA4454', background: 'rgba(250, 68, 84, 0.05)' },
    fortnite: { borderColor: '#9D4DFF', background: 'rgba(157, 77, 255, 0.05)' },
    battlenet: { borderColor: '#00AEFF', background: 'rgba(0, 174, 255, 0.05)' }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <FaGamepad className={styles.sectionIcon} />
        <h2>Gaming Profiles</h2>
      </div>
      
      <form onSubmit={handleSave} className={styles.form}>
        {/* Favorite Game */}
        <div 
          className={`${styles.formGroup} ${styles.platformSection}`}
          style={platformStyles.main}
        >
          <label htmlFor="favorite_game" className={styles.platformLabel}>
            <FaGamepad style={{ marginRight: '8px' }} />
            Your Main Game
          </label>
          <p className={styles.formDescription}>
            Select your favorite game to display on your profile
          </p>
          
          <select 
            id="favorite_game"
            name="favorite_game"
            value={profiles.favorite_game}
            onChange={handleChange}
            className={styles.formSelect}
          >
            <option value="">Select your main game</option>
            {gameOptions.map(game => (
              <option key={game} value={game}>{game}</option>
            ))}
          </select>
          
          {showCustomGameInput && (
            <div className={styles.customGameInput}>
              <input
                type="text"
                id="custom_game"
                name="custom_game"
                value={profiles.custom_game}
                onChange={handleChange}
                placeholder="Enter your favorite game"
                className={styles.formInput}
                style={{ marginTop: '10px' }}
              />
            </div>
          )}
        </div>

        {/* Discord ID */}
        <div 
          className={`${styles.formGroup} ${styles.platformSection}`}
          style={platformStyles.discord}
        >
          <label htmlFor="discord_id" className={styles.platformLabel}>
            <FaDiscord style={{ marginRight: '8px', color: '#5865F2' }} />
            Discord Username
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              id="discord_id"
              name="discord_id"
              value={profiles.discord_id}
              onChange={handleChange}
              placeholder="Your Discord username"
              className={`${styles.formInput} ${styles.discordInput}`}
            />
          </div>
        </div>

        {/* Valorant ID */}
        <div 
          className={`${styles.formGroup} ${styles.platformSection}`}
          style={platformStyles.valorant}
        >
          <label htmlFor="valorant_id" className={styles.platformLabel}>
            <SiValorant style={{ marginRight: '8px', color: '#FA4454' }} />
            Valorant ID
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              id="valorant_id"
              name="valorant_id"
              value={profiles.valorant_id}
              onChange={handleChange}
              placeholder="Your Valorant ID (e.g., name#tag)"
              className={`${styles.formInput} ${styles.valorantInput}`}
            />
          </div>
        </div>

        {/* Fortnite Name */}
        <div 
          className={`${styles.formGroup} ${styles.platformSection}`}
          style={platformStyles.fortnite}
        >
          <label htmlFor="fortnite_name" className={styles.platformLabel}>
            <SiEpicgames style={{ marginRight: '8px', color: '#9D4DFF' }} />
            Fortnite / Epic Games Username
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              id="fortnite_name"
              name="fortnite_name"
              value={profiles.fortnite_name}
              onChange={handleChange}
              placeholder="Your Fortnite/Epic Games username"
              className={`${styles.formInput} ${styles.fortniteInput}`}
            />
          </div>
        </div>

        {/* Battle.net ID */}
        <div 
          className={`${styles.formGroup} ${styles.platformSection}`}
          style={platformStyles.battlenet}
        >
          <label htmlFor="battlenet_id" className={styles.platformLabel}>
            <SiBattledotnet style={{ marginRight: '8px', color: '#00AEFF' }} />
            Battle.net ID
          </label>
          <div className={styles.inputWrapper}>
            <input
              type="text"
              id="battlenet_id"
              name="battlenet_id"
              value={profiles.battlenet_id}
              onChange={handleChange}
              placeholder="Your Battle.net ID (e.g., name#12345)"
              className={`${styles.formInput} ${styles.battlenetInput}`}
            />
          </div>
        </div>

        {message.text && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}

        <div className={styles.buttonGroup}>
          <button 
            type="submit" 
            className={styles.saveButton} 
            disabled={loading}
          >
            {loading ? 'Saving...' : (
              <>
                <FaSave className={styles.buttonIcon} />
                <span>Save Changes</span>
              </>
            )}
          </button>
      </div>
      </form>
    </section>
  );
};

export default GamingSection; 