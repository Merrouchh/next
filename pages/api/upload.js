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

// Add better error logging
const logError = (error, context) => {
  console.error(`Upload Error [${context}]:`, {
    message: error.message,
    stack: error.stack,
    code: error.code,
    details: error.details
  });
};

// Add directory permissions check
const checkDirectoryPermissions = async (dir) => {
  try {
    // Check if directory exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true, mode: 0o755 });
    }
    
    // Test write permissions
    const testFile = path.join(dir, '.test-write-permission');
    await fs.promises.writeFile(testFile, '');
    await fs.promises.unlink(testFile);
    
    return true;
  } catch (error) {
    logError(error, 'Directory Permissions');
    return false;
  }
};

// Add cleanup for temporary files
const cleanupFiles = (files) => {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.error('Error cleaning up file:', error);
      }
    }
  });
};

export default async function handler(req, res) {
  const tempFiles = [];
  let uploadedFile = null;

  // Add request logging
  console.log('Upload request received:', {
    method: req.method,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });

  // Handle client disconnection
  req.on('close', () => {
    if (req.aborted) {
      cleanupFiles(tempFiles);
    }
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient(req, res);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      logError(authError, 'Authentication');
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();

    if (userError) {
      logError(userError, 'User Data Fetch');
      return res.status(400).json({ error: 'Failed to fetch user data' });
    }

    // Check upload directory
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    const hasPermissions = await checkDirectoryPermissions(uploadDir);
    
    if (!hasPermissions) {
      return res.status(500).json({ 
        error: 'Server configuration error: Upload directory not writable',
        details: uploadDir
      });
    }

    // Configure formidable with better error handling
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filename: (name, ext, part) => {
        const timestamp = Date.now();
        const safeFilename = part.originalFilename
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        return `${timestamp}-${safeFilename}`;
      },
    });

    // Add detailed upload progress logging
    form.on('progress', (bytesReceived, bytesExpected) => {
      const progress = Math.floor((bytesReceived * 100) / bytesExpected);
      console.log(`Upload progress: ${progress}% (${bytesReceived}/${bytesExpected} bytes)`);
    });

    // Track upload errors
    form.on('error', error => {
      logError(error, 'Form Upload');
    });

    // Parse form with better error handling
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          logError(err, 'Form Parse');
          reject(new Error(`Failed to parse upload form: ${err.message}`));
        } else if (!files.file || !files.file[0]) {
          reject(new Error('No file uploaded'));
        } else {
          resolve([fields, files]);
        }
      });
    });

    const file = files.file[0];
    uploadedFile = file.filepath;

    // Verify file exists and is readable
    try {
      await fs.promises.access(file.filepath, fs.constants.R_OK);
    } catch (error) {
      logError(error, 'File Access');
      throw new Error(`Cannot access uploaded file: ${error.message}`);
    }

    // Parse metadata with better error handling
    let metadata = {};
    try {
      const { metadata: metadataString } = fields;
      const parsedMetadata = JSON.parse(metadataString);
      
      if (!parsedMetadata.title || !parsedMetadata.game || !parsedMetadata.visibility) {
        throw new Error('Missing required metadata fields');
      }
      
      metadata = parsedMetadata;
    } catch (error) {
      logError(error, 'Metadata Parse');
      throw new Error(`Invalid metadata format: ${error.message}`);
    }

    // Get video metadata with fallback
    let videoMetadata = {
      duration: 0,
      resolution: '1280x720',
      format: 'unknown',
      codec: 'unknown'
    };

    try {
      videoMetadata = await getVideoMetadata(file.filepath);
      console.log('Video metadata:', videoMetadata);
    } catch (error) {
      logError(error, 'Video Metadata');
      // Continue with default metadata
    }

    // Insert into database with better error handling
    const insertData = {
      user_id: user.id,
      file_name: file.originalFilename,
      file_path: file.filepath.replace(process.cwd(), ''),
      username: userData.username,
      title: metadata.title,
      game: metadata.game,
      visibility: metadata.visibility,
      status: 'uploaded',
      duration: videoMetadata.duration || 0,
      resolution: videoMetadata.resolution || '1280x720',
      format: videoMetadata.format || 'unknown',
      codec: videoMetadata.codec || 'unknown'
    };

    const { data: clipData, error: dbError } = await supabase
      .from('media_clips')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      logError(dbError, 'Database Insert');
      throw new Error(`Failed to save to database: ${dbError.message}`);
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

    tempFiles.push(uploadedFile);
    
    return res.status(200).json({
      message: 'Upload successful',
      progress: 100,
      clip: clipData,
    });
  } catch (error) {
    logError(error, 'Main Handler');
    
    // Clean up files
    cleanupFiles([...tempFiles, uploadedFile].filter(Boolean));

    return res.status(500).json({ 
      error: error.message || 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        path: uploadedFile
      } : undefined
    });
  }
} 