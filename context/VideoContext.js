import { createContext, useContext, useState } from 'react';

const VideoContext = createContext();

export function VideoProvider({ children }) {
  const [currentPlayingId, setCurrentPlayingId] = useState(null);

  return (
    <VideoContext.Provider value={{ currentPlayingId, setCurrentPlayingId }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
} 