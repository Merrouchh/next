import { createClient } from './component';

export const updateLike = async (clipId, userId) => {
  if (!clipId || !userId) return null;
  
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc('handle_like', { 
      p_clip_id: clipId, 
      p_user_id: userId 
    });
    
  if (error) throw error;
  return data;
};

export const checkLikeStatus = async (clipId, userId) => {
  if (!clipId || !userId) return false;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('video_likes')
    .select('id')
    .match({ clip_id: clipId, user_id: userId })
    .maybeSingle();
    
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
};

export const getLikesByClipId = async (clipId) => {
  if (!clipId) return [];

  // First get the likes
  const supabase = createClient();
  const { data: likes, error: likesError } = await supabase
    .from('video_likes')
    .select('id, user_id')
    .eq('clip_id', clipId);
    
  if (likesError) throw likesError;
  if (!likes?.length) return [];

  // Then get the users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username')
    .in('id', likes.map(like => like.user_id));

  if (usersError) throw usersError;

  // Combine the data
  return likes.map(like => ({
    ...like,
    users: users?.find(user => user.id === like.user_id) || { username: 'Unknown User' }
  }));
}; 