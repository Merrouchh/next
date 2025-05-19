// Achievement points mapping
export const ACHIEVEMENT_POINTS = {
  'main-game': 25,
  'first-profile': 15,
  'all-profiles': 50,
  'five-star-review': 35,
  'first-tournament': 30,
  'first-win': 100,
  'first-clip': 20,
  'phone-verified': 25,
  'first-interaction': 15,
  'achievement-collector': 50
};

// Achievement definitions
export const ACHIEVEMENTS = [
  {
    id: 'main-game',
    name: 'Game Identity',
    description: 'Added your main game to your profile',
    icon: 'gamepad',
    points: ACHIEVEMENT_POINTS['main-game'],
    link: '/editprofile',
    checkFn: (userData) => !!userData.favorite_game
  },
  {
    id: 'first-profile',
    name: 'Connected Gamer',
    description: 'Added at least one gaming profile',
    icon: 'user',
    points: ACHIEVEMENT_POINTS['first-profile'],
    link: '/editprofile',
    checkFn: (userData) => {
      return [
        userData.discord_id, 
        userData.valorant_id, 
        userData.fortnite_name, 
        userData.battlenet_id
      ].filter(Boolean).length > 0;
    }
  },
  {
    id: 'all-profiles',
    name: 'Network Master',
    description: 'Connected all gaming profiles (Discord, Valorant, Epic, Battle.net)',
    icon: 'crown',
    points: ACHIEVEMENT_POINTS['all-profiles'],
    link: '/editprofile',
    max_progress: 4,
    checkFn: (userData) => {
      return [
        userData.discord_id, 
        userData.valorant_id, 
        userData.fortnite_name, 
        userData.battlenet_id
      ].filter(Boolean).length >= 4;
    },
    getProgress: (userData) => {
      return [
        userData.discord_id, 
        userData.valorant_id, 
        userData.fortnite_name, 
        userData.battlenet_id
      ].filter(Boolean).length;
    }
  },
  {
    id: 'phone-verified',
    name: 'Secure Gamer',
    description: 'Added and verified your phone number',
    icon: 'mobile',
    points: ACHIEVEMENT_POINTS['phone-verified'],
    link: '/editprofile',
    checkFn: (userData) => !!userData.phone
  },
  {
    id: 'first-interaction',
    name: 'Community Engagement',
    description: 'Liked AND commented on clips',
    icon: 'thumbsup',
    points: ACHIEVEMENT_POINTS['first-interaction'],
    link: '/discover',
    max_progress: 2,
    checkFn: (userData) => userData.has_liked && userData.has_commented,
    getProgress: (userData) => {
      let progress = 0;
      if (userData.has_liked) progress += 1;
      if (userData.has_commented) progress += 1;
      return progress;
    }
  },
  {
    id: 'five-star-review',
    name: 'Feedback Champion',
    description: 'Left a 5-star google review for Merrouch Gaming',
    icon: 'thumbsup',
    points: ACHIEVEMENT_POINTS['five-star-review'],
    reviewUrl: 'https://g.page/r/CcW5rimv4M2TEAE/review',
    requiresVerification: true,
    link: '#'
  },
  {
    id: 'first-tournament',
    name: 'Tournament Debut',
    description: 'Participated in your first tournament',
    icon: 'trophy',
    points: ACHIEVEMENT_POINTS['first-tournament'],
    link: '/events'
  },
  {
    id: 'first-win',
    name: 'Victory Royale',
    description: 'Won your first tournament',
    icon: 'medal',
    points: ACHIEVEMENT_POINTS['first-win'],
    link: '/events'
  },
  {
    id: 'first-clip',
    name: 'Content Creator',
    description: 'Uploaded your first gaming clip',
    icon: 'star',
    points: ACHIEVEMENT_POINTS['first-clip'],
    link: '/profile'
  },
  {
    id: 'achievement-collector',
    name: 'Achievement Hunter',
    description: 'Claimed 6 achievements',
    icon: 'trophy',
    points: ACHIEVEMENT_POINTS['achievement-collector'],
    link: '/awards',
    max_progress: 6,
    checkFn: (userData) => (userData.claimed_achievements_count || 0) >= 6,
    getProgress: (userData) => Math.min((userData.claimed_achievements_count || 0), 6),
    extraRewards: {
      gameHours: 1
    }
  }
]; 