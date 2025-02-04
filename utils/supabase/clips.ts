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

// Add other clip-related Supabase functions here 