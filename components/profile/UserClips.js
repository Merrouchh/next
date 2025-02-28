import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/component';
import styles from '../../styles/Profile.module.css';
import ClipCard from '../ClipCard';

const UserClips = ({ userId, isOwner }) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);

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

  if (loading) {
    return (
      <div className={styles.clipsLoading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (error) {
    return <div className={styles.clipsError}>{error}</div>;
  }

  return (
    <div className={styles.clipsSection}>
      {console.log('Games array:', games)} {/* Debug log */}
      {games.length > 0 && (
        <div className={styles.gameFilters} style={{background: '#1a1a1a', padding: '1rem', margin: '1rem 0'}}>
          <button 
            className={`${styles.gameFilterButton} ${!selectedGame ? styles.active : ''}`}
            onClick={() => handleGameFilter(null)}
          >
            All Games ({clips.length})
            {isOwner && (
              <span className={styles.visibilityCount}>
                ({clips.filter(clip => clip.visibility === 'public').length} public)
              </span>
            )}
          </button>
          {games.map(game => {
            const gameClips = clips.filter(clip => (clip.game_name || clip.game) === game);
            const publicClips = gameClips.filter(clip => clip.visibility === 'public');
            
            return (
              <button
                key={game}
                className={`${styles.gameFilterButton} ${selectedGame === game ? styles.active : ''}`}
                onClick={() => handleGameFilter(game)}
              >
                {game} ({gameClips.length})
                {isOwner && publicClips.length !== gameClips.length && (
                  <span className={styles.visibilityCount}>
                    ({publicClips.length} public)
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className={`${styles.clipsGrid} ${isFiltering ? styles.filtering : ''}`}>
        {isFiltering ? (
          <div className={styles.filterLoading}>
            <div className={styles.spinner}></div>
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