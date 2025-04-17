import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Update the database with the current processing status
const updateProcessingStatus = async (videoUid, status, details = {}, userId = null) => {
  try {
    console.log(`[Upload-Status] Updating status to: ${status}, details:`, details);
    
    // Check if entry exists in clips table
    const { data: clipData } = await supabase
      .from('clips')
      .select('id')
      .eq('cloudflare_uid', videoUid)
      .single();
      
    if (clipData) {
      // Update existing entry
      const { error: clipsError } = await supabase
        .from('clips')
        .update({
          status: status,
          error_message: details.error_message || null,
          progress: details.progress || 0,
          status_message: details.status_message || null,
          last_updated: new Date().toISOString()
        })
        .eq('cloudflare_uid', videoUid);
        
      if (clipsError) {
        console.log(`[Upload-Status] Warning: Failed to update clips table: ${clipsError.message}`);
      } else {
        console.log(`[Upload-Status] Successfully updated clips table status to ${status}`);
      }
    } else if (userId) {
      // Try to create a new entry if we have user ID
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('username')
          .eq('id', userId)
          .single();
          
        const username = userData?.username || 'unknown';
        
        // Create a new entry in clips table
        const { error: insertError } = await supabase
          .from('clips')
          .insert([{
            cloudflare_uid: videoUid,
            user_id: userId,
            username: username,
            title: details.title || 'Untitled Upload',
            game: details.game || 'Unknown Game',
            visibility: details.visibility || 'public',
            uploaded_at: new Date().toISOString(),
            status: status,
            progress: details.progress || 0,
            status_message: details.status_message || null,
            error_message: details.error_message || null,
            initial_upload_timestamp: new Date().toISOString()
          }]);
            
        if (insertError) {
          console.log(`[Upload-Status] Warning: Failed to create clips entry: ${insertError.message}`);
        } else {
          console.log(`[Upload-Status] Created new clips entry with status ${status}`);
        }
      } catch (userError) {
        console.log(`[Upload-Status] Warning: Failed to get user data: ${userError.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`[Upload-Status] Error updating status: ${error.message}`);
    return false;
  }
};

export default async function handler(req, res) {
  // ===== STEP 0: HANDLE SPECIAL REQUESTS =====
  // Handle DELETE requests for cleanup
  if (req.method === 'DELETE') {
    const { uid, status } = req.query;
    
    if (!uid) {
      return res.status(400).json({ error: 'Missing uid parameter' });
    }
    
    try {
      console.log(`Processing cleanup for upload with uid: ${uid}`);
      
      // Update the status in clips table
      await updateProcessingStatus(uid, 'error', {
        error_message: 'Upload cancelled by user',
        status_message: 'Upload cancelled by user'
      });
      
      return res.status(200).json({ success: true, message: 'Upload cancelled successfully' });
    } catch (error) {
      console.error('Error during upload cleanup:', error);
      return res.status(500).json({ error: 'Internal server error during cleanup' });
    }
  }
  
  // Handle GET requests with status=closed (for beacon API)
  if (req.method === 'GET' && req.query.status === 'closed') {
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ error: 'Missing uid parameter' });
    }
    
    try {
      console.log(`Processing beacon cleanup for upload with uid: ${uid}`);
      
      // Update status in clips table
      await updateProcessingStatus(uid, 'error', {
        error_message: 'Upload cancelled - page closed by user',
        status_message: 'Page closed during upload'
      });
      
      return res.status(200).json({ success: true, message: 'Upload marked as cancelled' });
    } catch (error) {
      console.error('Error during beacon cleanup:', error);
      return res.status(500).json({ error: 'Internal server error during beacon cleanup' });
    }
  }
  
  // ===== STEP 1: VALIDATE REQUEST METHOD =====
  // Original POST handler for initiating uploads
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('=== COPY TO STREAM PROCESS STARTED ===');

  try {
    // ===== STEP 2: EXTRACT UPLOAD METADATA =====
    const { title, game, visibility, username, fileName, description } = req.body;
    console.log(`[Stream-Step 1] Processing upload request for: ${title} by ${username}`);
    console.log(`[Stream-Step 1a] File: ${fileName}, Game: ${game}, Visibility: ${visibility}`);

    // ===== STEP 3: VERIFY CLOUDFLARE CREDENTIALS =====
    // Check Cloudflare credentials
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.log('ERROR: Missing Cloudflare credentials', { 
        CLOUDFLARE_ACCOUNT_ID: !!CLOUDFLARE_ACCOUNT_ID, 
        CLOUDFLARE_API_TOKEN: !!CLOUDFLARE_API_TOKEN 
      });
      throw new Error('Cloudflare credentials are not configured');
    }

    // ===== STEP 4: REQUEST CLOUDFLARE UPLOAD URL =====
    // Get direct upload URL from Cloudflare
    console.log(`[Stream-Step 2] Requesting direct upload URL from Cloudflare`);
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`;
    console.log(`[Stream-Step 2a] Cloudflare API URL: ${cfUrl}`);
    
    const response = await fetch(
      cfUrl,
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
            username,
            description: description || ''
          },
          requireSignedURLs: false,
          enableDownloads: true
        })
      }
    );

    // ===== STEP 5: PROCESS CLOUDFLARE RESPONSE =====
    const data = await response.json();
    console.log(`[Stream-Step 3] Cloudflare API response:`, 
      { success: data.success, uid: data.result?.uid, status: response.status });
    
    if (!data.success) {
      console.log('ERROR: Failed to get upload URL from Cloudflare', data.errors);
      throw new Error(data.errors?.[0]?.message || 'Failed to get upload URL');
    }

    const cloudflareUid = data.result.uid;
    console.log(`[Stream-Step 4] Got direct upload URL and UID: ${cloudflareUid}`);

    // ===== STEP 6: FIND USER ID FROM USERNAME =====
    // Get user ID from username
    console.log(`[Stream-Step 5] Looking up user ID for username: ${username}`);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError) {
      console.log('ERROR: Failed to find user', userError);
      throw new Error('Failed to find user');
    }

    console.log(`[Stream-Step 6] Found user with ID: ${userData.id}`);
    const userId = userData.id;

    // ===== STEP 7: CREATE DATABASE RECORD =====
    // Create an entry in the clips table directly
    console.log(`[Stream-Step 7] Creating database record in clips table`);
    
    // ===== STEP 7.1: GENERATE UNIQUE FILENAME =====
    // Generate a unique filename to avoid constraints
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const cleanFileName = fileName.replace(/\.\w+$/, ''); // Remove extension if any
    const uniqueFileName = `${cleanFileName}_${cloudflareUid.substring(0, 6)}_${timestamp}_${randomString}`;
    
    // ===== STEP 7.2: GENERATE EXPECTED THUMBNAIL URL =====
    // Generate expected thumbnail URL based on Cloudflare's pattern
    const expectedThumbnailUrl = `https://customer-uqoxn79wf4pr7eqz.cloudflarestream.com/${cloudflareUid}/thumbnails/thumbnail.jpg`;
    console.log(`[Stream-Step 7b] Setting expected thumbnail URL: ${expectedThumbnailUrl}`);
    
    // ===== STEP 7.3: INSERT CLIP RECORD INTO DATABASE =====
    const { error: clipsError } = await supabase
      .from('clips')
      .insert([{
        cloudflare_uid: cloudflareUid,
        user_id: userId,
        username,
        title: title || 'Untitled Video',
        game: game || 'Other',
        visibility: visibility || 'public',
        file_name: uniqueFileName,
        file_path: `/videos/${uniqueFileName}`,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'uploading',
        thumbnail_path: expectedThumbnailUrl,
        thumbnail_url: expectedThumbnailUrl,
        hls_url: null,
        dash_url: null,
        mp4link: null,
        likes_count: 0,
        views_count: 0
      }]);
      
    // ===== STEP 7.4: VERIFY DATABASE INSERT =====
    if (clipsError) {
      console.log('ERROR: Failed to create clips record', clipsError);
      throw new Error(`Failed to store video information: ${clipsError.message}`);
    } else {
      console.log(`[Stream-Step 7a] Clips record created successfully`);
    }

    console.log(`[Stream-Step 8] Database record created successfully`);
    console.log('=== COPY TO STREAM PROCESS COMPLETED SUCCESSFULLY ===');
    
    // ===== STEP 8: RETURN SUCCESS RESPONSE =====
    return res.status(200).json({ 
      success: true, 
      uploadUrl: data.result.uploadURL,
      uid: cloudflareUid,
      message: 'Ready for direct upload'
    });
  } catch (error) {
    // ===== ERROR HANDLING =====
    console.log('=== COPY TO STREAM PROCESS FAILED ===', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.stack || error
    });
  }
} 