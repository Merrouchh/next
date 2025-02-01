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

    logger.info('Starting FFmpeg processing');
      await new Promise((resolve, reject) => {
        ffmpeg(tempFilePath)
          .outputOptions([
            '-c:v libx264',        // Video codec
            '-crf 18',             // Higher quality
            '-preset slow',      // Slower preset for better quality and compression
            '-profile:v high',     // Higher profile for H.264 for better quality
            '-tune film',          // Tune for visual quality (useful for detailed videos)
            '-c:a copy',           // Audio codec
            '-movflags +faststart', // Enable fast start for web playback
            '-y'                    // Overwrite output files
          ])
          .output(outputFilePath)
          .on('progress', (progress) => {
            const now = Date.now();
            if (now - lastProgressLog >= PROGRESS_LOG_INTERVAL) {
              logger.info(`Processing: ${progress.percent ? progress.percent.toFixed(1) : 0}% done`);
              lastProgressLog = now;
            }
          })
          .on('end', () => {
            logger.info('FFmpeg processing finished');
            resolve();
          })
          .on('error', (err) => {
            logger.error('FFmpeg processing error:', err);
            reject(err);
          })
          .run();
      });

    logger.info('Reading processed file for upload');
    // Upload processed file
    const processedFileBuffer = fs.readFileSync(outputFilePath);
    const timestamp = Date.now();
    const uniqueFileName = `${clipData.id}_${timestamp}.mp4`;
    const uploadPath = `video/${uniqueFileName}`;
    
    logger.info('Uploading processed file to:', uploadPath);
    const { error: uploadError } = await supabase
      .storage
      .from('highlight-clips')
      .upload(uploadPath, processedFileBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed file: ${uploadError.message}`);
    }

    // Move original file to processed folder
    const processedUploadsDir = path.join(process.cwd(), '..', 'public', 'uploads', 'processed');
    if (!fs.existsSync(processedUploadsDir)) {
      fs.mkdirSync(processedUploadsDir, { recursive: true });
    }
    
    const processedLocalPath = path.join(processedUploadsDir, path.basename(clipData.file_path));
    
    // Check if source file still exists and is accessible
    if (fs.existsSync(localFilePath)) {
      try {
        // Try to move the file
        fs.renameSync(localFilePath, processedLocalPath);
        logger.info('Successfully moved file to processed folder');
      } catch (moveError) {
        logger.warn('Could not move file to processed folder:', moveError.message);
        // Try to copy instead of move
        try {
          fs.copyFileSync(localFilePath, processedLocalPath);
          // If copy succeeds, try to delete the original
          try {
            fs.unlinkSync(localFilePath);
            logger.info('Successfully copied and deleted original file');
          } catch (deleteError) {
            logger.warn('Could not delete original file:', deleteError.message);
          }
        } catch (copyError) {
          logger.warn('Could not copy file to processed folder:', copyError.message);
        }
      }
    } else {
      logger.warn('Original file no longer exists:', localFilePath);
    }

    // Insert into clips table
    const { error: insertError } = await supabase
      .from('clips')
      .insert({
        user_id: clipData.user_id,
        file_name: uniqueFileName,
        file_path: uploadPath,
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
    // Update clip record to completed
    await updateClipStatus(clipData.id, 'completed');

  } catch (error) {
    logger.error('Error processing video:', error);
    logger.info('Calling updateClipStatus with error:', { clipId: clipData.id, error: error.message });
    await updateClipStatus(clipData.id, 'error', error.message);
  } finally {
    // Clean up all temporary files
    logger.info('Cleaning up all temporary files');
    
    // Clean temp directory
    try {
      const tempFiles = fs.readdirSync(tempDir);
      logger.info('Files in temp directory:', tempFiles);
      
      // Files we need to clean for this clip
      const filesToMatch = [
        `temp_${clipData.id}`,       // temp file
        `processed_${clipData.id}`,   // processed file
        `thumbnail_${clipData.id}`,   // thumbnail
        `${clipData.id}_`            // any other files with clip ID
      ];
      
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        // Check if file matches any of our patterns
        if (filesToMatch.some(pattern => file.includes(pattern))) {
          try {
            fs.unlinkSync(filePath);
            logger.info(`Cleaned up temp file: ${file}`);
          } catch (err) {
            logger.warn(`Failed to delete temp file ${file}:`, err.message);
          }
        } else {
          logger.info(`Skipping file ${file} as it doesn't match cleanup patterns`);
        }
      }

      // Double check if directory is empty and log remaining files
      const remainingFiles = fs.readdirSync(tempDir);
      if (remainingFiles.length > 0) {
        logger.info('Remaining files in temp directory:', remainingFiles);
      } else {
        logger.info('Temp directory is empty');
      }
    } catch (err) {
      logger.warn('Error cleaning temp directory:', err.message);
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