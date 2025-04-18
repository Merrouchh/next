import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'clips.merrouchgaming.com';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Validate R2 configuration
if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ACCOUNT_ID) {
  console.error('[R2-Config] ❌ Missing R2 configuration. Please check environment variables:');
  console.error(`R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);
  console.error(`R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
  console.error(`R2_BUCKET_NAME: ${R2_BUCKET_NAME ? '✅ Set' : '❌ Missing'}`);
  console.error(`R2_ACCOUNT_ID: ${R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing'}`);
  throw new Error('R2 configuration is incomplete. Please check environment variables.');
}

/**
 * Downloads a file from a URL
 * @param {string} url - The URL to download from
 * @returns {Promise<Buffer>} The downloaded file as a buffer
 */
async function downloadFile(url) {
  try {
    console.log(`[R2-Step 1] 📥 Downloading file from: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const fileBuffer = Buffer.from(await response.arrayBuffer());
    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[R2-Step 1] ✅ Downloaded file successfully: ${fileBuffer.length} bytes (${fileSizeMB} MB)`);
    return fileBuffer;
  } catch (error) {
    console.error(`[R2-Step 1] ❌ Error downloading file: ${error.message}`);
    throw error;
  }
}

/**
 * Uploads a file to R2
 * @param {string} key - The key to store the file under in R2
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @returns {Promise<string>} The URL of the uploaded file
 */
async function uploadToR2(key, fileBuffer) {
  try {
    console.log(`[R2-Step 2] 📤 Uploading file to R2 with key: ${key}`);
    console.log(`[R2-Step 2] ℹ️ Using bucket: ${R2_BUCKET_NAME}`);
    console.log(`[R2-Step 2] ℹ️ Using endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    console.log(`[R2-Step 2] ℹ️ Public URL format: https://${R2_PUBLIC_URL}`);
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    });

    await s3Client.send(command);
    const fileUrl = `https://${R2_PUBLIC_URL}/${key}`;
    console.log(`[R2-Step 2] ✅ File uploaded successfully: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error(`[R2-Step 2] ❌ Error uploading to R2: ${error.message}`);
    console.error(`[R2-Step 2] ❌ Error details:`, error);
    throw error;
  }
}

/**
 * Updates the database with error status
 * @param {string} videoUid - Cloudflare video UID
 * @param {string} errorMessage - Error message
 */
async function updateErrorStatus(videoUid, errorMessage) {
  try {
    await supabase
      .from('clips')
      .update({
        status: 'error',
        error_message: errorMessage
      })
      .eq('cloudflare_uid', videoUid);
  } catch (error) {
    console.error(`[R2] Error updating database with error status: ${error.message}`);
  }
}

/**
 * API handler for uploading MP4 to R2
 */
export default async function handler(req, res) {
  // Step 1: Validate request method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { videoUid } = req.body;
  const source = req.headers.source || 'unknown';
  const requestId = Math.random().toString(36).substring(2, 15);
  const startTime = Date.now();

  console.log(`[R2-Upload-${requestId}] 🚀 Starting R2 upload process for ${videoUid}. Source: ${source}`);

  // Step 2: Validate videoUid
  if (!videoUid) {
    console.error(`[R2-Upload-${requestId}] ❌ No videoUid provided`);
    return res.status(400).json({ message: 'videoUid is required' });
  }

  try {
    // Step 3: Check if video exists and get current status
    const { data: existingData, error: dbError } = await supabase
      .from('clips')
      .select('*')
      .eq('cloudflare_uid', videoUid)
      .single();

    if (dbError || !existingData) {
      console.error(`[R2-Upload-${requestId}] ❌ Video ${videoUid} not found in database`);
      return res.status(404).json({ message: 'Video not found' });
    }

    // Step 4: Get current status
    const currentStatus = existingData.status;
    console.log(`[R2-Upload-${requestId}] 📊 Video current status: ${currentStatus}`);

    // Step 5: If already in r2_uploading or complete status, return success
    if (['r2_uploading', 'complete'].includes(currentStatus)) {
      console.log(`[R2-Upload-${requestId}] ✓ Video ${videoUid} already in ${currentStatus} status, skipping`);
      return res.status(200).json({ 
        message: `Video already in ${currentStatus} status`,
        status: currentStatus
      });
    }

    // Step 6: If not in mp4_downloading status, return error
    if (currentStatus !== 'mp4_downloading') {
      console.log(`[R2-Upload-${requestId}] ⚠️ Video ${videoUid} is not in mp4_downloading status (current: ${currentStatus})`);
      return res.status(400).json({ 
        message: 'Video is not ready for R2 upload',
        currentStatus: currentStatus
      });
    }

    // Step 7: Get MP4 URL from database
    const mp4Url = existingData.mp4link;
    if (!mp4Url) {
      const errorMessage = 'No MP4 URL found in database';
      console.error(`[R2-Upload-${requestId}] ❌ ${errorMessage}`);
      await updateErrorStatus(videoUid, errorMessage);
      return res.status(400).json({ message: errorMessage });
    }

    // Step 8: Download MP4 from Cloudflare
    const fileBuffer = await downloadFile(mp4Url);
    const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`[R2-Upload-${requestId}] ✅ Downloaded MP4 file: ${fileSizeMB} MB`);

    // Step 9: Update status to r2_uploading before starting R2 upload
    console.log(`[R2-Upload-${requestId}] ⚠️ Updating status to r2_uploading`);
    await supabase
      .from('clips')
      .update({
        status: 'r2_uploading'
      })
      .eq('cloudflare_uid', videoUid);

    // Step 10: Upload to R2
    const r2Key = `videos/${videoUid}.mp4`;
    const r2Url = await uploadToR2(r2Key, fileBuffer);

    // Step 11: Update database with R2 URL and complete status
    console.log(`[R2-Upload-${requestId}] ⚠️ Updating database with R2 URL and complete status`);
    const { error: updateError } = await supabase
      .from('clips')
      .update({
        status: 'complete',
        mp4link: r2Url
      })
      .eq('cloudflare_uid', videoUid);

    if (updateError) {
      console.error(`[R2-Upload-${requestId}] ❌ Error updating database:`, updateError);
      throw updateError;
    }

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[R2-Upload-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
    console.log(`[R2-Upload-${requestId}] ✅ R2 UPLOAD COMPLETED SUCCESSFULLY`);
    console.log(`[R2-Upload-${requestId}] 📊 Video ${videoUid} is now COMPLETE`);
    console.log(`[R2-Upload-${requestId}] 🔗 MP4 URL: ${r2Url}`);
    console.log(`[R2-Upload-${requestId}] ⏱️ Processing time: ${processingTime} seconds`);
    console.log(`[R2-Upload-${requestId}] ✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨`);
    
    return res.status(200).json({
      message: 'Video uploaded to R2 successfully',
      status: 'complete',
      mp4link: r2Url,
      processingTime: `${processingTime} seconds`
    });
  } catch (error) {
    console.error(`[R2-Upload-${requestId}] ❌ Error processing ${videoUid}: ${error.message}`);
    
    // Step 12: Update database with error status
    await updateErrorStatus(videoUid, error.message);
      
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
}