export const handleLike = async (clip, supabase, setClips, setLikedClips, likedClips) => {
  try {
    const newLiked = !likedClips[clip.id];
    const { error } = await supabase
      .from('clips')
      .update({ likes_count: clip.likes_count + (newLiked ? 1 : -1) })
      .eq('id', clip.id);

    if (error) throw error;

    setClips(prevClips => prevClips.map(c => 
      c.id === clip.id ? { ...c, likes_count: c.likes_count + (newLiked ? 1 : -1) } : c
    ));
    setLikedClips(prev => ({ ...prev, [clip.id]: newLiked }));
  } catch (err) {
    console.error('Error updating like:', err);
  }
}; 