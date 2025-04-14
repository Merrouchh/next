import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/component';
import styles from '../../styles/Profile.module.css';
import ClipCard from '../ClipCard';
import { FaFilter, FaTimes } from 'react-icons/fa';

const UserClips = ({ userId, isOwner }) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    // Add click outside handler
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchClips = async () => {
      if (!userId) {
        setError('Invalid user ID');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        let query = supabase
          .from('clips')
          .select('*')
          .eq('user_id', userId)
          .order('uploaded_at', { ascending: false });

        // Only filter by visibility if not the owner
        if (!isOwner) {
          query = query.eq('visibility', 'public');
        }

        const { data, error } = await query;

        if (error) throw error;

        console.log('Fetched clips:', data);
        
        // Extract unique games from clips
        const uniqueGames = [...new Set(data
          .map(clip => clip.game_name || clip.game)
          .filter(Boolean))];
        console.log('Unique games found:', uniqueGames);
        
        setClips(data || []);
        setGames(uniqueGames);
      } catch (err) {
        console.error('Error fetching clips:', err);
        setError('Failed to load clips');
      } finally {
        setLoading(false);
      }
    };

    fetchClips();
  }, [userId, isOwner]);

  const handleGameFilter = (game) => {
    setIsFiltering(true);
    setSelectedGame(game);
    setShowFilters(false);
    setTimeout(() => {
      setIsFiltering(false);
    }, 300);
  };

  const handleClipUpdate = (clipId, action, updatedData) => {
    if (action === 'delete') {
      setClips(clips.filter(c => c.id !== clipId));
    } else if (action === 'visibility') {
      setClips(clips.map(clip => 
        clip.id === clipId 
          ? { ...clip, visibility: updatedData.visibility }
          : clip
      ));
    }
  };

  const filteredClips = selectedGame 
    ? clips.filter(clip => (clip.game_name || clip.game) === selectedGame)
    : clips;

  const renderFilters = () => {
    if (isMobile) {
      return (
        <div className={styles.filtersWrapper} ref={filterRef}>
          <button 
            className={styles.mobileFilterButton}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> Filter: {selectedGame || "All Games"}
          </button>
          
          {showFilters && (
            <div className={styles.mobileFilters}>
              <button 
                className={`${styles.filterButton} ${!selectedGame ? styles.filterActive : ''}`}
                onClick={() => handleGameFilter(null)}
              >
                All Games ({clips.length})
              </button>
              
              {games.map(game => {
                const gameClips = clips.filter(clip => (clip.game_name || clip.game) === game);
                
                return (
                  <button
                    key={game}
                    className={`${styles.filterButton} ${selectedGame === game ? styles.filterActive : ''}`}
                    onClick={() => handleGameFilter(game)}
                  >
                    {game} ({gameClips.length})
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    
    // Desktop filters
    return (
      <div className={styles.filtersDesktop}>
        <button 
          className={`${styles.filterButton} ${!selectedGame ? styles.filterActive : ''}`}
          onClick={() => handleGameFilter(null)}
        >
          All Games ({clips.length})
        </button>
        
        {games.map(game => {
          const gameClips = clips.filter(clip => (clip.game_name || clip.game) === game);
          
          return (
            <button
              key={game}
              className={`${styles.filterButton} ${selectedGame === game ? styles.filterActive : ''}`}
              onClick={() => handleGameFilter(game)}
            >
              {game} ({gameClips.length})
            </button>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.clipsSection}>
        {games.length > 0 && renderFilters()}
        <div className={styles.clipsGrid}>
          <div className={styles.filterLoading}>
            <div 
              className={styles.spinner} 
              style={{ 
                border: '4px solid rgba(138, 43, 226, 0.15)', 
                borderTop: '4px solid #8A2BE2',
                width: '50px',
                height: '50px',
                boxShadow: '0 0 15px rgba(138, 43, 226, 0.3)'
              }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className={styles.clipsError}>{error}</div>;
  }

  return (
    <div className={styles.clipsSection}>
      {games.length > 0 && renderFilters()}

      <div className={`${styles.clipsGrid} ${isFiltering ? styles.filtering : ''}`}>
        {isFiltering ? (
          <div className={styles.filterLoading}>
            <div 
              className={styles.spinner}
              style={{ 
                border: '4px solid rgba(138, 43, 226, 0.15)', 
                borderTop: '4px solid #8A2BE2',
                width: '50px',
                height: '50px',
                boxShadow: '0 0 15px rgba(138, 43, 226, 0.3)'
              }}
            ></div>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className={styles.noClipsContainer}>
            <p className={styles.noClipsMessage}>
              {selectedGame 
                ? `No clips found for ${selectedGame}`
                : isOwner 
                  ? "You haven't shared any clips yet" 
                  : "No clips shared yet"
              }
            </p>
            {isOwner && !selectedGame && (
              <p className={styles.noClipsSubtext}>
                Share your gaming moments with the community!
              </p>
            )}
          </div>
        ) : (
          filteredClips.map((clip) => (
            <ClipCard 
              key={clip.id} 
              clip={clip}
              onClipUpdate={handleClipUpdate}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default UserClips; 