import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, game, visibility, username, fileName } = req.body;

    // Get direct upload URL from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600,
          creator: username,
          meta: {
            name: title,
            title,
            game,
            visibility,
            username
          },
          requireSignedURLs: false
        })
      }
    );

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to get upload URL');
    }

    // Get user ID from username
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError) {
      throw new Error('Failed to find user');
    }

    // Create the initial record
    const { error: createError } = await supabase
      .from('media_clips')
      .insert([{
        cloudflare_uid: data.result.uid,
        user_id: userData.id,
        status: 'uploading',
        metadata: {
          title,
          game,
          visibility,
          username,
          original_filename: fileName,
          upload_started_at: new Date().toISOString()
        },
        title,
        game,
        visibility,
        username,
        file_name: fileName,
        uploaded_at: new Date().toISOString()
      }]);

    if (createError) {
      throw new Error(`Failed to store video information: ${createError.message}`);
    }

    return res.status(200).json({ 
      success: true, 
      uploadUrl: data.result.uploadURL,
      uid: data.result.uid,
      message: 'Ready for direct upload'
    });
  } catch (error) {
    console.error('Error in direct upload setup:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error
    });
  }
} 