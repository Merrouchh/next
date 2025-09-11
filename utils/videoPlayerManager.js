// Global video player manager to handle multiple players on the same page
class VideoPlayerManager {
  constructor() {
    this.activePlayers = new Map();
    this.currentlyPlayingId = null;
    // Track the most recently registered player for each clip
    this.clipToPlayerId = new Map();
  }

  // Register a player with the manager
  registerPlayer(playerId, playerRef) {
    console.log(`Registering player: ${playerId}`);
    
    // Store the clip ID to player ID mapping if available
    if (playerRef && playerRef.options_ && playerRef.options_.sources && playerRef.options_.sources[0]) {
      const source = playerRef.options_.sources[0].src;
      if (source) {
        const clipId = playerId.split('_')[1]; // Extract clip ID from player ID
        if (clipId) {
          this.clipToPlayerId.set(clipId, playerId);
          console.log(`Mapped clip ID ${clipId} to player ${playerId}`);
        }
      }
    }
    
    this.activePlayers.set(playerId, playerRef);
    
    return () => {
      console.log(`Unregistering player: ${playerId}`);
      this.activePlayers.delete(playerId);
      
      // Remove from currently playing if this was the active player
      if (this.currentlyPlayingId === playerId) {
        this.currentlyPlayingId = null;
      }
      
      // Remove clip mapping if present
      for (const [clipId, id] of this.clipToPlayerId.entries()) {
        if (id === playerId) {
          this.clipToPlayerId.delete(clipId);
          console.log(`Removed clip mapping for ${clipId}`);
        }
      }
    };
  }

  // Notify the manager that a player has started playing
  playerStartedPlaying(playerId) {
    console.log(`Player started playing: ${playerId}`);
    console.log(`Current active player: ${this.currentlyPlayingId}`);
    console.log(`Active players count: ${this.activePlayers.size}`);
    
    // Don't do anything if this is already the active player
    if (this.currentlyPlayingId === playerId) {
      console.log(`Player ${playerId} is already the active player`);
      return;
    }
    
    // Set the new currently playing player first so we don't pause ourselves
    this.currentlyPlayingId = playerId;
    
    // Add a small delay before pausing other players to prevent race condition
    // This gives the current player time to actually start playing
    setTimeout(() => {
      // More aggressive pause of ALL other players
      this.pauseAllExcept(playerId);
      
      // Log active players for debugging
      this.logActivePlayers();
    }, 100); // 100ms delay to prevent interrupting the play() call
  }
  
  // Explicitly pause all players except the given one
  pauseAllExcept(exceptPlayerId) {
    console.log(`Pausing all players except ${exceptPlayerId}`);
    console.log(`Active players to check:`, Array.from(this.activePlayers.keys()));
    
    // Create a copy of the active players to avoid modification issues during iteration
    const playerEntries = [...this.activePlayers.entries()];
    
    playerEntries.forEach(([id, player]) => {
      if (id !== exceptPlayerId) {
        console.log(`Attempting to pause player ${id} (not ${exceptPlayerId})`);
        try {
          // Double-check that we're not trying to pause the currently playing player
          if (id === this.currentlyPlayingId) {
            console.log(`Skipping pause for currently playing player ${id}`);
            return;
          }
          // Most basic validity check first
          if (!player) {
            console.log(`Player ${id} is null or undefined, skipping`);
            return;
          }
          
          // Check if the player has a valid dispose method (indicates it's a video.js player)
          if (typeof player.dispose !== 'function') {
            console.log(`Player ${id} lacks dispose method, likely invalid or already disposed`);
            this.activePlayers.delete(id); // Clean up reference
            return;
          }
          
          // Check if player has been disposed or is in process of being disposed
          if (player.isDisposed_ || player.isDisposed()) {
            console.log(`Player ${id} is already disposed, removing from active players`);
            this.activePlayers.delete(id);
            return;
          }
          
          // Check if player has valid tech
          if (!player.tech || !player.tech_) {
            console.log(`Player ${id} has no tech, pausing without state check`);
            if (typeof player.pause === 'function') {
              player.pause();
            }
            return;
          }
          
          // Finally, if we passed all checks, try the normal path
          if (typeof player.pause === 'function' && typeof player.paused === 'function') {
            try {
              // Check if player is in the process of starting to play (readyState 0-2)
              if (player.readyState && player.readyState() < 3) {
                console.log(`Player ${id} is still loading (readyState: ${player.readyState()}), skipping pause`);
                return;
              }
              
              // Final safety check right before calling paused()
              if (player.tech && player.tech_.el_) {
                if (!player.paused()) {
                  console.log(`Pausing player: ${id}`);
                  player.pause();
                } else {
                  console.log(`Player ${id} is already paused`);
                }
              } else {
                // Tech exists but el_ doesn't, try direct pause
                console.log(`Player ${id} has no tech.el_, pausing directly`);
                player.pause();
              }
            } catch (innerError) {
              console.error(`Error checking paused state for ${id}, falling back to direct pause`, innerError);
              // Just try to pause anyway as a last resort
              try {
                player.pause();
              } catch (finalError) {
                console.error(`Final pause attempt failed for ${id}`, finalError);
              }
            }
          }
        } catch (error) {
          console.error(`Error handling player ${id}:`, error);
          // Clean up reference to potentially bad player
          this.activePlayers.delete(id);
        }
      }
    });
  }

  // Force pause all players - useful for external calls
  pauseAll() {
    console.log('Force pausing all video players');
    try {
      // Safer implementation that doesn't rely on pauseAllExcept
      // This is important during page navigation when player instances may be invalid
      const playerEntries = [...this.activePlayers.entries()];
      
      // First mark that no player is currently playing
      this.currentlyPlayingId = null;
      
      // Then attempt to pause each player individually with minimal checking
      playerEntries.forEach(([id, player]) => {
        try {
          if (player && typeof player.pause === 'function') {
            console.log(`Direct pause attempt on player ${id} during pauseAll`);
            player.pause();
          }
        } catch {
          console.log(`Could not pause player ${id}, may be disposed already`);
        }
      });
    } catch (error) {
      console.error('Error during force pause all:', error);
      // Still reset the currently playing ID even if we hit an error
      this.currentlyPlayingId = null;
    }
  }

  // Get the total number of active players
  getPlayerCount() {
    return this.activePlayers.size;
  }

  // For debugging purposes
  logActivePlayers() {
    console.log('Active Players:', Array.from(this.activePlayers.keys()));
    console.log('Currently Playing:', this.currentlyPlayingId);
    console.log('Clip Mappings:', Array.from(this.clipToPlayerId.entries()));
  }
}

// Create a singleton instance
const videoPlayerManager = new VideoPlayerManager();

export default videoPlayerManager; 