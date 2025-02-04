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

if (!global.uploadLogs) {
  global.uploadLogs = [];
}

const addLog = (type, message, details = {}) => {
  const log = {
    type,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  console.log(`[${type}]`, message, details);
  
  // Keep only last 100 logs
  global.uploadLogs = [log, ...global.uploadLogs.slice(0, 99)];
  
  return log;
};

// Add more detailed error logging
const logError = (error, context) => {
  const errorDetails = {
    context,
    message: error.message,
    stack: error.stack,
    code: error.code,
    details: error.details,
    time: new Date().toISOString(),
    // Add system info
    systemInfo: {
      platform: process.platform,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      cwd: process.cwd()
    }
  };
  
  addLog('ERROR', `Upload Error [${context}]`, errorDetails);
  return errorDetails;
};

// Add more robust directory check
const checkDirectoryPermissions = async (dir) => {
  try {
    // Get absolute path
    const absolutePath = path.resolve(dir);
    addLog('INFO', 'Checking directory permissions for:', absolutePath);

    // Check if directory exists and create if not
    if (!fs.existsSync(absolutePath)) {
      addLog('INFO', 'Directory does not exist, creating...');
      await fs.promises.mkdir(absolutePath, { recursive: true, mode: 0o755 });
    }

    // Check directory stats
    const stats = await fs.promises.stat(absolutePath);
    addLog('INFO', 'Directory stats:', {
      isDirectory: stats.isDirectory(),
      mode: stats.mode.toString(8),
      uid: stats.uid,
      gid: stats.gid
    });

    // Test write permissions with more details
    const testFile = path.join(absolutePath, '.test-write-permission');
    await fs.promises.writeFile(testFile, 'test');
    await fs.promises.unlink(testFile);

    return {
      success: true,
      path: absolutePath,
      stats: stats
    };
  } catch (error) {
    const errorDetails = logError(error, 'Directory Permissions');
    return {
      success: false,
      error: errorDetails,
      path: dir
    };
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

  // Add specific error response helper
  const sendError = (status, message, details = {}) => {
    const error = {
      error: message,
      timestamp: new Date().toISOString(),
      details: {
        ...details,
        uploadDir: path.join(process.cwd(), 'public', 'uploads'),
        method: req.method,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
      }
    };
    
    // Always log the error
    addLog('ERROR', message, error);
    
    return res.status(status).json(error);
  };

  addLog('INFO', 'Upload request received', {
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

  try {
    if (req.method !== 'POST') {
      return sendError(405, 'Method not allowed');
    }

    // Check content type
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      return sendError(400, 'Invalid content type', { 
        expected: 'multipart/form-data',
        received: req.headers['content-type'] 
      });
    }

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

    // Log request details
    addLog('INFO', 'Upload request details:', {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
      },
      url: req.url,
      query: req.query
    });

    // Add more specific error checks for directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const dirCheck = await checkDirectoryPermissions(uploadDir);
    
    if (!dirCheck.success) {
      return sendError(500, 'Upload directory error', {
        path: dirCheck.path,
        error: dirCheck.error,
        stats: dirCheck.stats
      });
    }

    // Configure formidable with more options
    const form = formidable({
      uploadDir: dirCheck.path,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      multiples: false,
      filename: (name, ext, part) => {
        const timestamp = Date.now();
        const safeFilename = part.originalFilename
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        return `${timestamp}-${safeFilename}`;
      },
      filter: (part) => {
        // Only accept video files
        return part.mimetype?.includes('video/');
      }
    });

    // Add detailed upload progress logging
    form.on('progress', (bytesReceived, bytesExpected) => {
      const progress = Math.floor((bytesReceived * 100) / bytesExpected);
      addLog('INFO', 'Upload progress:', { progress: `${progress}% (${bytesReceived}/${bytesExpected} bytes)` });
    });

    // Track upload errors
    form.on('error', error => {
      logError(error, 'Form Upload');
    });

    // Add more specific error handling for form parsing
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject({
            message: 'Form parse error',
            details: err.message,
            code: err.code
          });
        } else if (!files.file || !files.file[0]) {
          reject({
            message: 'No file uploaded',
            details: 'File field is missing or empty'
          });
        } else {
          resolve([fields, files]);
        }
      });
    }).catch(error => {
      throw error; // This will be caught by the outer try-catch
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
      addLog('INFO', 'Video metadata:', videoMetadata);
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
    return sendError(500, error.message || 'Upload failed', error.details || {});
  }
} 