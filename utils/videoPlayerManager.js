// Global video player manager to handle multiple players on the same page
class VideoPlayerManager {
  constructor() {
    this.activePlayers = new Map();
    this.currentlyPlayingId = null;
  }

  // Register a player with the manager
  registerPlayer(playerId, playerRef) {
    this.activePlayers.set(playerId, playerRef);
    return () => {
      this.activePlayers.delete(playerId);
      if (this.currentlyPlayingId === playerId) {
        this.currentlyPlayingId = null;
      }
    };
  }

  // Notify the manager that a player has started playing
  playerStartedPlaying(playerId) {
    console.log(`Player ${playerId} started playing`);
    
    // If this is a different player than what's currently playing
    if (this.currentlyPlayingId !== null && this.currentlyPlayingId !== playerId) {
      const previousPlayer = this.activePlayers.get(this.currentlyPlayingId);
      if (previousPlayer && typeof previousPlayer.pause === 'function') {
        // Pause the previously playing video
        console.log(`Pausing player: ${this.currentlyPlayingId} because player: ${playerId} started`);
        previousPlayer.pause();
      } else {
        console.warn(`Could not pause previous player ${this.currentlyPlayingId}:`, 
          previousPlayer ? 'Player reference exists but no pause method' : 'No player reference found');
      }
    } else {
      console.log(`No need to pause other players. Current: ${this.currentlyPlayingId}, New: ${playerId}`);
    }
    
    // Set the new currently playing player
    this.currentlyPlayingId = playerId;
    console.log(`Updated current player to: ${this.currentlyPlayingId}`);
  }

  // Notify the manager that a player has been paused
  playerPaused(playerId) {
    // Only clear the currentlyPlayingId if this player was the one playing
    if (this.currentlyPlayingId === playerId) {
      console.log(`Player ${playerId} paused, clearing current player reference`);
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
  }
}

// Create a singleton instance
const videoPlayerManager = new VideoPlayerManager();

export default videoPlayerManager; 