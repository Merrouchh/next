import React, { createContext, useContext, useState } from 'react';

const VideoContext = createContext();

export function VideoProvider({ children }) {
  const [currentPlayingId, setCurrentPlayingId] = useState(null);

  const value = {
    currentPlayingId,
    setCurrentPlayingId,
  };

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
} 