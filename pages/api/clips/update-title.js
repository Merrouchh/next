import { createClient } from '../../../utils/supabase/server-props';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Supabase client (secure method)
    const supabase = createClient({ req, res });

    // Get authenticated user (secure method)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Check authentication
    if (userError || !user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { clipId, title } = req.body;

    if (!clipId) {
      return res.status(400).json({ error: 'Clip ID is required' });
    }

    if (title === undefined || title === null) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify the user owns this clip
    const { data: clip, error: clipError } = await supabase
      .from('clips')
      .select('user_id')
      .eq('id', clipId)
      .single();

    if (clipError || !clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    if (clip.user_id !== user.id) {
      return res.status(403).json({ error: 'You can only edit your own clips' });
    }

    // Update the title
    const { data: updatedClip, error: updateError } = await supabase
      .from('clips')
      .update({ title: title.trim() || null })
      .eq('id', clipId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating clip title:', updateError);
      return res.status(500).json({ error: 'Failed to update clip title' });
    }

    return res.status(200).json({ 
      message: 'Title updated successfully',
      clip: updatedClip
    });
  } catch (error) {
    console.error('Error in update-title API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

