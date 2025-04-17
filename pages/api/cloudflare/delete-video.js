import { createClient } from '@supabase/supabase-js';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Delete a video from Cloudflare Stream and database
 * This API can be used to cancel uploads or delete videos entirely
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId, videoUid, userId } = req.body;

  // We need either videoId or videoUid to identify the video
  if (!videoId && !videoUid) {
    return res.status(400).json({ 
      error: 'Missing required parameter', 
      message: 'Either videoId or videoUid is required'
    });
  }

  console.log(`[DELETE-VIDEO] Request to delete video ${videoId || videoUid}`);
  
  try {
    // Step 1: Find the video in the database
    let query = supabase.from('clips').select('*');
    
    if (videoId) {
      query = query.eq('id', videoId);
    } else {
      query = query.eq('cloudflare_uid', videoUid);
    }
    
    // If userId is provided, ensure the user has permission to delete
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: video, error: findError } = await query.single();
    
    if (findError || !video) {
      console.log(`[DELETE-VIDEO] Video not found:`, findError?.message || 'No matching video');
      return res.status(404).json({ 
        error: 'Video not found', 
        message: findError?.message || 'Could not find the video in the database'
      });
    }
    
    // Store the video data for the response before it's deleted
    const videoData = { ...video };
    const cloudflareUid = video.cloudflare_uid;
    
    console.log(`[DELETE-VIDEO] Found video ${video.id} with Cloudflare UID ${cloudflareUid}`);
    
    // Step 2: Delete from Cloudflare if it has a Cloudflare UID
    let cloudflareDeleted = false;
    
    if (cloudflareUid) {
      try {
        console.log(`[DELETE-VIDEO] Deleting from Cloudflare: ${cloudflareUid}`);
        
        // First try to delete any downloads if they exist
        try {
          const downloadResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${cloudflareUid}/downloads`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (downloadResponse.ok) {
            console.log(`[DELETE-VIDEO] Successfully deleted downloads for ${cloudflareUid}`);
          } else {
            console.log(`[DELETE-VIDEO] Failed to delete downloads or none existed: ${downloadResponse.status}`);
          }
        } catch (downloadError) {
          console.log(`[DELETE-VIDEO] Error deleting downloads:`, downloadError.message);
          // Continue with video deletion even if download deletion fails
        }
        
        // Now delete the video itself
        const cloudflareResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${cloudflareUid}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const cloudflareData = await cloudflareResponse.json();
        
        if (cloudflareResponse.ok) {
          console.log(`[DELETE-VIDEO] Successfully deleted from Cloudflare`);
          cloudflareDeleted = true;
        } else {
          console.log(`[DELETE-VIDEO] Failed to delete from Cloudflare:`, cloudflareData);
          // We'll still proceed with database deletion even if Cloudflare deletion fails
        }
      } catch (cloudflareError) {
        console.error(`[DELETE-VIDEO] Error deleting from Cloudflare:`, cloudflareError);
        // We'll still proceed with database deletion even if Cloudflare deletion fails
      }
    } else {
      console.log(`[DELETE-VIDEO] No Cloudflare UID, skipping Cloudflare deletion`);
    }
    
    // Step 3: Delete from database
    console.log(`[DELETE-VIDEO] Deleting from database: ${video.id}`);
    const { error: deleteError } = await supabase
      .from('clips')
      .delete()
      .eq('id', video.id);
    
    if (deleteError) {
      console.error(`[DELETE-VIDEO] Error deleting from database:`, deleteError);
      
      // If we deleted from Cloudflare but failed to delete from database, this is a problem
      if (cloudflareDeleted) {
        return res.status(500).json({
          error: 'Partial deletion',
          message: 'Video was deleted from Cloudflare but not from the database',
          cloudflare: cloudflareDeleted,
          database: false,
          videoData
        });
      }
      
      // Update database with error information
      const errorUpdate = {
        status: 'error',
        error_message: deleteError.message
      };

      await supabase
        .from('clips')
        .update(errorUpdate)
        .eq('cloudflare_uid', cloudflareUid);
      
      throw deleteError;
    }
    
    console.log(`[DELETE-VIDEO] Successfully deleted video ${video.id}`);
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Video successfully deleted',
      cloudflare: cloudflareDeleted,
      database: true,
      videoData
    });
    
  } catch (error) {
    console.error(`[DELETE-VIDEO] Unexpected error:`, error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 