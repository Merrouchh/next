import { createContext, useContext, useState, useCallback } from 'react';

const VideoContext = createContext(null);

export const VideoProvider = ({ children }) => {
  const [currentPlayingId, setCurrentPlayingId] = useState(null);

  const handleSetCurrentPlaying = useCallback((id) => {
    setCurrentPlayingId((prevId) => {
      if (prevId === id) return prevId;
      console.log('Switching active video:', { from: prevId, to: id });
      return id;
    });
  }, []);

  return (
    <VideoContext.Provider value={{
      currentPlayingId,
      setCurrentPlayingId: handleSetCurrentPlaying,
    }}>
      {children}
    </VideoContext.Provider>
  );
};

export function useVideo() {
  const context = useContext(VideoContext);
  if (context === null) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
} 