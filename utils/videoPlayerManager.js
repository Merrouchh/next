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
    // If this is a different player than what's currently playing
    if (this.currentlyPlayingId !== null && this.currentlyPlayingId !== playerId) {
      const previousPlayer = this.activePlayers.get(this.currentlyPlayingId);
      if (previousPlayer && typeof previousPlayer.pause === 'function') {
        // Pause the previously playing video
        console.log(`Pausing player: ${this.currentlyPlayingId} because player: ${playerId} started`);
        previousPlayer.pause();
      }
    }
    // Set the new currently playing player
    this.currentlyPlayingId = playerId;
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