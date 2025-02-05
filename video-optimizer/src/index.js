require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

// Set up Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write logs to a file with daily rotation
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console logging only in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Add progress logging variables
let lastProgressLog = 0;
const PROGRESS_LOG_INTERVAL = 5000; // Log every 5 seconds
let isProcessing = false; // Flag to indicate if processing is ongoing

async function generateThumbnail(inputPath, clipId) {
  const thumbnailPath = path.join(tempDir, `thumbnail_${clipId}.jpg`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['10%'],
        filename: `thumbnail_${clipId}.jpg`,
        folder: tempDir,
        size: '1280x720'
      })
      .on('end', () => {
        logger.info('Thumbnail generated successfully');
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        logger.error('Error generating thumbnail:', err);
        reject(err);
      });
  });
}

async function processVideo(clipData) {
  logger.info('Processing clip with data:', {
    id: clipData.id,
    file_path: clipData.file_path,
    file_name: clipData.file_name,
    title: clipData.title,
    username: clipData.username,
    game: clipData.game
  });

  // Normalize file path by converting Windows backslashes to forward slashes
  const normalizedPath = clipData.file_path.replace(/\\/g, '/');
  // Check if file exists in local uploads directory
  const localFilePath = path.join(process.cwd(), '..', 'public', 'uploads', path.basename(normalizedPath));
  logger.info('Checking local file path:', localFilePath);

  if (!fs.existsSync(localFilePath)) {
    logger.error('File not found in local uploads directory:', localFilePath);
    logger.info('Calling updateClipStatus with error:', { clipId: clipData.id });
    await updateClipStatus(clipData.id, 'error', 'File not found in uploads directory');
    return;
  }

  // Update status to processing before starting
  logger.info('Calling updateClipStatus to set processing:', { clipId: clipData.id });
  await updateClipStatus(clipData.id, 'processing');

  const tempFilePath = path.join(tempDir, `temp_${clipData.id}${path.extname(clipData.file_name)}`);
  const outputFilePath = path.join(tempDir, `processed_${clipData.id}.mp4`);

  try {
    // Copy file from uploads to temp directory
    logger.info('Copying file to temp directory');
    fs.copyFileSync(localFilePath, tempFilePath);

    // Generate thumbnail first
    logger.info('Generating thumbnail');
    const thumbnailPath = await generateThumbnail(tempFilePath, clipData.id);
    
    // Upload thumbnail
    logger.info('Uploading thumbnail');
    const thumbnailBuffer = fs.readFileSync(thumbnailPath);
    const thumbnailUploadPath = `thumbnail/${clipData.id}.jpg`;
    
    const { error: thumbnailError } = await supabase
      .storage
      .from('highlight-clips')
      .upload(thumbnailUploadPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (thumbnailError) {
      throw new Error(`Failed to upload thumbnail: ${thumbnailError.message}`);
    }

    logger.info('Starting FFmpeg HLS processing');
    const hlsOutputDir = path.join(tempDir, `hls_${clipData.id}`);
    if (!fs.existsSync(hlsOutputDir)) {
      fs.mkdirSync(hlsOutputDir);
    }

    // First pass: Create 1080p version
    await new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .outputOptions([
          '-c:v libx264',          // Video codec
          '-c:a aac',              // Audio codec
          '-ac 2',                 // 2 audio channels
          '-ar 48000',             // Audio sample rate
          '-b:a 192k',             // Audio bitrate
          
          // HLS Specific settings
          '-hls_time 6',           // 6 second segments
          '-hls_list_size 0',      // Keep all segments
          '-hls_flags independent_segments', // Each segment can be decoded independently
          '-hls_segment_type mpegts',      // Segment type
          '-hls_segment_filename', `${hlsOutputDir}/1080p_%03d.ts`,
          '-f hls',                // HLS format
          '-hls_playlist_type vod', // Video on demand
          
          // Video settings
          '-vf scale=-2:1080',     // Scale to 1080p maintaining aspect ratio
          '-b:v 5000k',            // Video bitrate
          '-maxrate 5350k',        // Maximum bitrate (1.07x bitrate)
          '-bufsize 10000k',       // Buffer size (2x bitrate)
          '-profile:v main',       // Main profile for better compatibility
          '-level:v 4.1',          // Compatibility level
          '-preset fast',          // Faster encoding, good balance
          '-crf 23',              // Default quality
          '-g 48',                // Keyframe interval (2 seconds at 24fps)
          '-keyint_min 48',       // Minimum keyframe interval
          '-sc_threshold 0',       // Scene change threshold
          '-pix_fmt yuv420p',      // Pixel format for maximum compatibility
          '-y'                     // Overwrite output
        ])
        .output(`${hlsOutputDir}/1080p.m3u8`)
        .on('progress', (progress) => {
          const now = Date.now();
          if (now - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
            logger.info(`HLS Processing (1080p): ${progress.percent ? progress.percent.toFixed(1) : 0}% done`);
            lastProgressLog = now;
          }
        })
        .on('end', resolve)
        .on('error', (err) => {
          logger.error('FFmpeg 1080p error:', err.message || err);
          logger.error('FFmpeg command:', err.cmd);
          reject(err);
        })
        .run();
    });

    // Update master playlist for 1080p
    const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,CODECS="avc1.4d401f,mp4a.40.2"
1080p.m3u8`;

    fs.writeFileSync(path.join(hlsOutputDir, 'master.m3u8'), masterPlaylist);

    // Upload HLS files to Supabase storage
    const hlsFiles = fs.readdirSync(hlsOutputDir);
    const timestamp = Date.now();
    const hlsBasePath = `video/${clipData.id}_${timestamp}`;

    for (const file of hlsFiles) {
      const filePath = path.join(hlsOutputDir, file);
      const uploadPath = `${hlsBasePath}/${file}`;
      const fileBuffer = fs.readFileSync(filePath);

      const { error: uploadError } = await supabase
        .storage
        .from('highlight-clips')
        .upload(uploadPath, fileBuffer, {
          contentType: file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T',
          upsert: true
        });

      if (uploadError) throw new Error(`Failed to upload HLS file ${file}: ${uploadError.message}`);
      logger.info(`Uploaded ${file} successfully`);
    }

    // Insert into clips table with HLS path
    const { error: insertError } = await supabase
      .from('clips')
      .insert({
        user_id: clipData.user_id,
        file_name: `${clipData.id}_${timestamp}/master.m3u8`,
        file_path: `${hlsBasePath}/master.m3u8`,
        username: clipData.username,
        title: clipData.title,
        game: clipData.game,
        visibility: clipData.visibility,
        thumbnail_path: thumbnailUploadPath
      });

    if (insertError) {
      throw new Error(`Failed to insert into clips table: ${insertError.message}`);
    }

    logger.info('Upload successful, calling updateClipStatus to set completed:', { clipId: clipData.id });
    await updateClipStatus(clipData.id, 'completed');

  } catch (error) {
    logger.error('Error processing video:', error);
    logger.info('Calling updateClipStatus with error:', { clipId: clipData.id, error: error.message });
    await updateClipStatus(clipData.id, 'error', error.message);
  } finally {
    // Clean up all temporary files
    logger.info('Cleaning up all temporary files');
    
    try {
      // Clean temp directory
      const tempFiles = fs.readdirSync(tempDir);
      logger.info('Files in temp directory:', tempFiles);
      
      // Files we need to clean for this clip
      const filesToMatch = [
        `temp_${clipData.id}`,       // temp file
        `processed_${clipData.id}`,   // processed file
        `thumbnail_${clipData.id}`,   // thumbnail
        `hls_${clipData.id}`,        // HLS directory
        `${clipData.id}_`            // any other files with clip ID
      ];
      
      // Clean individual files
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        // Check if file matches any of our patterns
        if (filesToMatch.some(pattern => file.includes(pattern))) {
          try {
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              // If it's a directory (like HLS folder), remove recursively
              fs.rmSync(filePath, { recursive: true, force: true });
              logger.info(`Cleaned up directory: ${file}`);
            } else {
              // If it's a file, remove it
              fs.unlinkSync(filePath);
              logger.info(`Cleaned up file: ${file}`);
            }
          } catch (err) {
            logger.warn(`Failed to delete ${file}:`, err.message);
          }
        } else {
          logger.info(`Skipping file ${file} as it doesn't match cleanup patterns`);
        }
      }

      // Clean up HLS directory if it still exists
      const hlsDir = path.join(tempDir, `hls_${clipData.id}`);
      if (fs.existsSync(hlsDir)) {
        try {
          fs.rmSync(hlsDir, { recursive: true, force: true });
          logger.info('Cleaned up HLS directory');
        } catch (err) {
          logger.warn('Failed to delete HLS directory:', err.message);
        }
      }

      // Double check if directory is empty and log remaining files
      const remainingFiles = fs.readdirSync(tempDir);
      if (remainingFiles.length > 0) {
        logger.info('Remaining files in temp directory:', remainingFiles);
      } else {
        logger.info('Temp directory is empty');
      }

      // Clean up processed file from uploads directory
      const processedLocalPath = path.join(process.cwd(), '..', 'public', 'uploads', 'processed', path.basename(clipData.file_path));
      if (fs.existsSync(processedLocalPath)) {
        try {
          fs.unlinkSync(processedLocalPath);
          logger.info('Cleaned up processed file from uploads directory');
        } catch (err) {
          logger.warn('Failed to delete processed file:', err.message);
        }
      }

      // Clean up original file from uploads directory
      const originalLocalPath = path.join(process.cwd(), '..', 'public', 'uploads', path.basename(clipData.file_path));
      if (fs.existsSync(originalLocalPath)) {
        try {
          fs.unlinkSync(originalLocalPath);
          logger.info('Cleaned up original file from uploads directory');
        } catch (err) {
          logger.warn('Failed to delete original file:', err.message);
        }
      }

    } catch (err) {
      logger.warn('Error during cleanup:', err.message);
    }

    // Check for new uploads after processing
    await checkForNewUploads();
  }
}

async function updateClipStatus(clipId, status, errorMessage = null) {
  logger.info('Updating clip status:', { clipId, status, errorMessage });
  
  if (!clipId) {
    logger.error('No clipId provided to updateClipStatus');
    return;
  }

  const updates = {
    status,
    ...(errorMessage && { error_message: errorMessage })
  };

  logger.info('Sending update to Supabase:', { updates, clipId });

  const { error } = await supabase
    .from('media_clips')
    .update(updates)
    .eq('id', clipId);

  if (error) {
    logger.error('Error updating clip status:', error);
  } else {
    logger.info('Successfully updated clip status');
  }
}

async function checkForNewUploads() {
  if (isProcessing) {
    logger.info('Already processing a clip, skipping new uploads check.');
    return; // Skip if already processing
  }

  isProcessing = true; // Set processing flag
  logger.info('Checking for new uploads...');

  const { data: clips, error } = await supabase
    .from('media_clips')
    .select(`
      id,
      title,
      file_path,
      file_name,
      status,
      uploaded_at,
      user_id,
      username,
      game,
      visibility
    `)
    .eq('status', 'uploaded')
    .order('uploaded_at', { ascending: true });

  if (error) {
    logger.error('Error fetching clips:', error);
    isProcessing = false; // Reset processing flag
    return;
  }

  logger.info(`Found ${clips?.length || 0} clips to process`);
  
  if (clips?.length > 0) {
    logger.info('Clips to process:', clips.map(clip => ({
      id: clip.id,
      title: clip.title,
      file_path: clip.file_path,
      status: clip.status,
      uploaded_at: clip.uploaded_at
    })));

    for (const clip of clips) {
      logger.info(`Starting to process clip:`, {
        id: clip.id,
        title: clip.title,
        status: clip.status
      });
      await processVideo(clip);
      logger.info(`Finished processing clip ${clip.id}`);
    }
  }

  isProcessing = false; // Reset processing flag after processing
}

// Run every minute
cron.schedule('* * * * *', checkForNewUploads);

logger.info('Video optimizer service started...'); 