import { createClient } from './component'

// First, add a function to check if user has liked the clip
export const checkLikeStatus = async (clipId: number, userId: string) => {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('video_likes')
    .select('*')
    .eq('clip_id', clipId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found" error
  return !!data; // returns true if like exists, false otherwise
};

export const updateLike = async (clipId: number, userId: string, isAdding: boolean) => {
  const supabase = createClient()
  
  // First check current like status
  const currentlyLiked = await checkLikeStatus(clipId, userId);
  
  // Only proceed if we're changing the state
  if (currentlyLiked === isAdding) {
    return null;
  }
  
  const { data, error } = await supabase
    .rpc('handle_like', {
      p_clip_id: clipId,
      p_user_id: userId,
      p_is_adding: isAdding
    });

  if (error) throw error;
  return data;
};

export const getLikesByClipId = async (clipId: number) => {
  const supabase = createClient();
  
  console.log('Starting likes fetch for clip:', clipId);

  // First get the likes
  const { data: likes, error: likesError } = await supabase
    .from('video_likes')
    .select('*')
    .eq('clip_id', clipId)
    .order('created_at', { ascending: false });

  if (likesError) {
    console.error('Error fetching likes:', likesError);
    throw likesError;
  }

  if (!likes || likes.length === 0) {
    return [];
  }

  // Then get the usernames for those likes
  const userIds = likes.map(like => like.user_id);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching users:', usersError);
    throw usersError;
  }

  // Combine the data
  const likesWithUsers = likes.map(like => ({
    id: like.id,
    clip_id: like.clip_id,
    user_id: like.user_id,
    created_at: like.created_at,
    userDetails: users.find(user => user.id === like.user_id)
  }));

  console.log('Combined likes data:', likesWithUsers);

  return likesWithUsers;
};

// Add other clip-related Supabase functions here 