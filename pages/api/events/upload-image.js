import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
// import path from 'path'; // Removed unused import
import { 
  compressEventImage, 
  validateImageFile, 
  generateOptimizedFilename,
  getImageMetadata 
} from '../../../utils/imageCompression';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Disable the default body parser to handle form data
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper function to parse form data with formidable
const parseForm = async (req) => {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Image upload request received');

  // Create a Supabase client with the auth token from the request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.authorization,
        Cookie: req.headers.cookie
      }
    }
  });

  // Check if user is authenticated and is an admin
  try {
    console.log('Verifying authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized', details: authError?.message });
    }
    
    // Check if user is an admin
    console.log('Checking admin status...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData || !userData.is_admin) {
      console.error('Admin check error:', userError);
      return res.status(403).json({ error: 'Forbidden: Admin access required', details: userError?.message });
    }
    
    console.log('Authentication verified, user is admin');
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication error', details: error.message });
  }

  try {
    // Parse form data
    console.log('Parsing form data...');
    const { fields, files } = await parseForm(req);
    
    const eventId = fields.eventId?.[0] || fields.eventId;
    const file = files.image?.[0] || files.image;
    
    console.log('Form data parsed:', { eventId, fileReceived: !!file });
    
    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }
    
    // Validate image file
    console.log('Validating image file...');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Read file
    console.log('Reading file content...');
    const filePath = file.filepath || file.path;
    const originalFileContent = fs.readFileSync(filePath);
    const originalFilename = file.originalFilename || file.name;
    
    // Get original image metadata
    console.log('Getting original image metadata...');
    const originalMetadata = await getImageMetadata(originalFileContent);
    console.log('Original image:', {
      size: `${(originalMetadata.size / 1024).toFixed(1)}KB`,
      dimensions: `${originalMetadata.width}x${originalMetadata.height}`,
      format: originalMetadata.format
    });

    // Compress image for social media optimization
    console.log('Compressing image for social media optimization...');
    const compressedFileContent = await compressEventImage(originalFileContent);
    
    // Get compressed image metadata
    const compressedMetadata = await getImageMetadata(compressedFileContent);
    console.log('Compressed image:', {
      size: `${(compressedMetadata.size / 1024).toFixed(1)}KB`,
      dimensions: `${compressedMetadata.width}x${compressedMetadata.height}`,
      format: compressedMetadata.format,
      compressionRatio: `${((1 - compressedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`
    });

    // Generate optimized filename
    const fileName = generateOptimizedFilename(originalFilename, `event-${eventId}`, 'jpg');
    
    console.log('Uploading optimized image to Supabase Storage:', { 
      fileName, 
      originalSize: `${(originalMetadata.size / 1024).toFixed(1)}KB`,
      compressedSize: `${(compressedMetadata.size / 1024).toFixed(1)}KB`,
      contentType: 'image/jpeg'
    });
    
    // Upload compressed image to Supabase Storage
    const { error } = await supabase
      .storage
      .from('images')
      .upload(fileName, compressedFileContent, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading to Supabase:', error);
      return res.status(500).json({ error: 'Failed to upload image', details: error.message });
    }
    
    console.log('File uploaded successfully, getting public URL...');
    
    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('images')
      .getPublicUrl(fileName);
    
    const imageUrl = urlData.publicUrl;
    console.log('Image public URL:', imageUrl);
    
    // Update event with image URL
    console.log('Fetching event data...');
    const { data: eventData, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching event data:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch event data', details: fetchError.message });
    }
    
    // Update event with image URL while preserving other fields
    console.log('Updating event with image URL...');
    const { error: updateError } = await supabase
      .from('events')
      .update({ 
        image: imageUrl,
        // Only include these fields if they exist in the original event data
        ...(eventData.title && { title: eventData.title }),
        ...(eventData.description && { description: eventData.description }),
        ...(eventData.date && { date: eventData.date }),
        ...(eventData.time && { time: eventData.time }),
        ...(eventData.location && { location: eventData.location }),
        ...(eventData.game && { game: eventData.game }),
        ...(eventData.status && { status: eventData.status })
      })
      .eq('id', eventId);
    
    if (updateError) {
      console.error('Error updating event with image URL:', updateError);
      return res.status(500).json({ error: 'Failed to update event with image URL', details: updateError.message });
    }
    
    console.log('Event updated successfully with new image URL');
    return res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Error handling image upload:', error);
    return res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
} 