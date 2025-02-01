import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { getVideoMetadata } from '../../utils/videoUtils';
import createServerSupabaseClient from '../../utils/supabase/api';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  let uploadedFile = null;

  // Handle client disconnection
  req.on('close', () => {
    if (uploadedFile && fs.existsSync(uploadedFile) && req.aborted) {
      try {
        fs.unlinkSync(uploadedFile);
        console.log('Cleaned up cancelled upload:', uploadedFile);
      } catch (error) {
        console.error('Error cleaning up file:', error);
      }
    }
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get authenticated user from Supabase
    const supabase = createServerSupabaseClient(req, res);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user's username from the users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('User data error:', userError);
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    if (!userData) {
      return res.status(400).json({ error: 'User profile not found' });
    }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (error) {
        console.error('Directory creation error:', error);
        return res.status(500).json({ error: 'Failed to create upload directory' });
      }
    }

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filename: (name, ext, part) => {
        // Generate unique filename
        return `${Date.now()}-${part.originalFilename}`;
      },
    });

    let uploadProgress = 0;
    form.on('progress', (bytesReceived, bytesExpected) => {
      uploadProgress = Math.floor((bytesReceived * 100) / bytesExpected);
      console.log(`Upload progress: ${uploadProgress}%`);
    });

    // Track the file being uploaded
    form.on('fileBegin', (formName, file) => {
      uploadedFile = file.filepath;
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Form parse error:', err);
          reject(new Error('Failed to parse upload form'));
        } else if (!files.file || !files.file[0]) {
          reject(new Error('No file uploaded'));
        } else {
          resolve([fields, files]);
        }
      });
    });

    const file = files.file[0];
    uploadedFile = file.filepath; // Update the filepath
    
    // Parse metadata JSON string
    let { metadata: metadataString } = fields;
    let { title, game, visibility } = {};
    
    try {
      const parsedMetadata = JSON.parse(metadataString);
      title = parsedMetadata.title;
      game = parsedMetadata.game;
      visibility = parsedMetadata.visibility;
    } catch (error) {
      console.error('Error parsing metadata:', error);
      throw new Error('Invalid metadata format');
    }

    // Validate required fields
    if (!title || !game || !visibility) {
      throw new Error('Missing required fields');
    }

    // Get video metadata (duration and resolution)
    let metadata;
    try {
      console.log('Attempting to get metadata for:', file.filepath);
      metadata = await getVideoMetadata(file.filepath);
      console.log('Successfully got metadata:', metadata);
    } catch (metadataError) {
      console.error('Metadata extraction failed:', metadataError);
      metadata = {
        duration: 0,
        resolution: '1280x720',
        format: 'unknown',
        codec: 'unknown'
      };
    }

    // Ensure metadata has required properties
    if (!metadata || typeof metadata !== 'object') {
      console.warn('Invalid metadata object, using defaults');
      metadata = {
        duration: 0,
        resolution: '1280x720',
        format: 'unknown',
        codec: 'unknown'
      };
    }

    // Store metadata in Supabase
    const insertData = {
      user_id: user.id,
      file_name: file.originalFilename,
      file_path: file.filepath.replace(process.cwd(), ''),
      username: userData.username,
      title,
      game,
      visibility,
      status: 'uploaded',
      duration: metadata.duration || 0,
      resolution: metadata.resolution || '1280x720'
    };

    // Add optional fields if they exist in the schema
    if (metadata.format) insertData.format = metadata.format;
    if (metadata.codec) insertData.codec = metadata.codec;

    const { data: clipData, error: dbError } = await supabase
      .from('media_clips')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to save to database');
    }

    // Clean up old files (optional)
    const oldFiles = fs.readdirSync(uploadDir);
    if (oldFiles.length > 10) { // Keep only last 10 files
      oldFiles
        .map(f => path.join(uploadDir, f))
        .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime())
        .slice(10)
        .forEach(f => fs.unlinkSync(f));
    }

    // Clear the uploadedFile variable since upload was successful
    uploadedFile = null;

    return res.status(200).json({
      message: 'Upload successful',
      progress: 100,
      clip: clipData,
    });
  } catch (error) {
    // Clean up the uploaded file if there was an error
    if (uploadedFile && fs.existsSync(uploadedFile)) {
      try {
        fs.unlinkSync(uploadedFile);
        console.log('Cleaned up failed upload:', uploadedFile);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }

    console.error('Upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 