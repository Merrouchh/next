import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// Function to check if ffprobe is installed
const checkFfprobe = async () => {
  try {
    await execAsync('ffprobe -version');
    return true;
  } catch (error) {
    console.error('ffprobe not found:', error.message);
    return false;
  }
};

export const getVideoMetadata = async (filePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    // Check if ffprobe is available
    const ffprobeAvailable = await checkFfprobe();
    if (!ffprobeAvailable) {
      console.warn('ffprobe not available, returning default metadata');
      return {
        duration: 0,
        resolution: '1280x720',
        format: 'unknown',
        codec: 'unknown'
      };
    }

    // Use ffprobe to get metadata
    const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);

    // Extract relevant metadata
    const videoStream = data.streams.find(stream => stream.codec_type === 'video');
    
    if (!videoStream) {
      throw new Error('No video stream found');
    }

    return {
      duration: Math.round(parseFloat(data.format.duration || '0')),
      resolution: `${videoStream.width || 1280}x${videoStream.height || 720}`,
      format: data.format.format_name || 'unknown',
      codec: videoStream.codec_name || 'unknown'
    };
  } catch (error) {
    console.error('Video metadata extraction error:', error);
    // Return default values if metadata extraction fails
    return {
      duration: 0,
      resolution: '1280x720',
      format: 'unknown',
      codec: 'unknown'
    };
  }
}; 
