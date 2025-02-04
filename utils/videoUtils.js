import ffmpeg from 'fluent-ffmpeg';
import ffprobe from '@ffprobe-installer/ffprobe';
import fs from 'fs';

// Log ffprobe path for debugging
console.log('FFprobe path:', ffprobe.path);
ffmpeg.setFfprobePath(ffprobe.path);

export const getVideoMetadata = async (filePath) => {
  let ffprobeProcess = null;

  try {
    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      throw new Error('File not found');
    }

    const metadata = await new Promise((resolve, reject) => {
      ffprobeProcess = ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('FFprobe error:', err);
          reject(err);
          return;
        }

        console.log('Raw metadata:', JSON.stringify(metadata, null, 2));

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          console.warn('No video stream found in:', metadata.streams);
          reject(new Error('No video stream found'));
          return;
        }

        console.log('Video stream:', JSON.stringify(videoStream, null, 2));

        const duration = metadata.format.duration 
          ? Math.round(metadata.format.duration)
          : Math.round(videoStream.duration || 0);

        const width = videoStream.width || 1280;
        const height = videoStream.height || 720;

        const result = {
          duration,
          resolution: `${width}x${height}`,
          format: metadata.format.format_name,
          codec: videoStream.codec_name
        };

        console.log('Extracted metadata:', result);
        resolve(result);
      });
    });

    return metadata;
  } catch (error) {
    console.error('Video metadata extraction error:', error);
    // Return default values if metadata extraction fails
    return {
      duration: 0,
      resolution: '1280x720',
      format: 'unknown',
      codec: 'unknown'
    };
  } finally {
    // Cleanup ffprobe process
    if (ffprobeProcess && ffprobeProcess.kill) {
      ffprobeProcess.kill();
    }
  }
}; 
