import React, { createContext, useContext, useState, useRef } from 'react';

const VideoContext = createContext();

export function VideoProvider({ children }) {
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const players = useRef(new Map()).current;

  const registerPlayer = (id, player) => {
    if (players.has(id)) unregisterPlayer(id);
    players.set(id, player);
  };

  const unregisterPlayer = (id) => {
    players.delete(id);
    if (currentPlayingId === id) setCurrentPlayingId(null);
  };

  const pauseOthers = (currentId) => {
    if (currentPlayingId === currentId) return;
    
    players.forEach((player, id) => {
      if (id !== currentId) player.pause();
    });
    
    setCurrentPlayingId(currentId);
  };

  return (
    <VideoContext.Provider value={{ registerPlayer, unregisterPlayer, pauseOthers }}>
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
