import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a singleton Supabase client to enable connection pooling
let supabaseClientSingleton;

function getSupabaseClient(headers = {}) {
  if (!supabaseClientSingleton) {
    supabaseClientSingleton = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      },
      global: {
        headers
      },
      // Add reasonable timeout settings
      realtime: {
        timeout: 20000 // 20s for realtime connections
      },
      db: {
        schema: 'public'
      }
    });
  }
  return supabaseClientSingleton;
}

// Disable the default body parser for POST requests to handle form data
export const config = {
  api: {
    bodyParser: false,
    // Add API timeout
    externalResolver: true,
  },
};

// Helper function to parse form data with formidable
const parseForm = async (req) => {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      maxFields: 5, // Limit number of fields
      maxFieldsSize: 1 * 1024 * 1024, // 1MB limit for fields
    });
    
    // Add timeout to form parsing
    const timeout = setTimeout(() => {
      reject(new Error('Form parsing timed out'));
    }, 30000); // 30 second timeout
    
    form.parse(req, (err, fields, files) => {
      clearTimeout(timeout);
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
};

// Helper function to authenticate and verify admin status
const authenticateAdmin = async (authHeaders) => {
  const supabase = getSupabaseClient(authHeaders);
  
  try {
    // Check if user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }
    
    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData || !userData.is_admin) {
      throw new Error('Forbidden: Admin access required');
    }
    
    return user;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

// Add request timeout wrapper
const withTimeout = (promise, timeoutMs = 30000) => {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export default async function handler(req, res) {
  // Set response headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  try {
    // Create a Supabase client with the auth token from the request
    const headers = {
      Authorization: req.headers.authorization,
      Cookie: req.headers.cookie
    };
    const supabase = getSupabaseClient(headers);

    // GET: Fetch gallery images for an event
    if (req.method === 'GET') {
      try {
        const { eventId } = req.query;
        
        if (!eventId) {
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        // Fetch all gallery images for this event with timeout
        const { data, error } = await withTimeout(
          supabase
            .from('event_gallery')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false }),
          15000 // 15 second timeout
        );
        
        if (error) {
          console.error('Error fetching gallery images:', error);
          return res.status(500).json({ error: 'Failed to fetch gallery images' });
        }
        
        return res.status(200).json({ images: data || [] });
      } catch (error) {
        console.error('Error handling gallery fetch:', error);
        const isTimeout = error.message && error.message.includes('timed out');
        
        if (isTimeout) {
          return res.status(504).json({ error: 'Gallery fetch timed out', images: [] });
        }
        
        return res.status(500).json({ error: 'Internal server error', images: [] });
      }
    }
    
    // POST: Upload a new image to event gallery
    else if (req.method === 'POST') {
      try {
        // Verify admin status
        await withTimeout(authenticateAdmin({
          Authorization: req.headers.authorization,
          Cookie: req.headers.cookie
        }), 10000);
        
        // Parse form data with timeout
        const { fields, files } = await withTimeout(parseForm(req), 30000);
        
        const eventId = fields.eventId?.[0] || fields.eventId;
        const caption = fields.caption?.[0] || fields.caption || '';
        const file = files.image?.[0] || files.image;
        
        if (!file) {
          return res.status(400).json({ error: 'No image file provided' });
        }
        
        if (!eventId) {
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        // Read file
        const filePath = file.filepath || file.path;
        const fileContent = fs.readFileSync(filePath);
        const originalFilename = file.originalFilename || file.name;
        const fileExt = path.extname(originalFilename);
        const fileName = `gallery-${eventId}-${Date.now()}${fileExt}`;
        
        // Upload to Supabase Storage with timeout
        const { data, error } = await withTimeout(
          supabase
            .storage
            .from('images')
            .upload(fileName, fileContent, {
              contentType: file.mimetype,
              upsert: true
            }),
          30000 // 30 second timeout for upload
        );
        
        if (error) {
          console.error('Error uploading to Supabase:', error);
          return res.status(500).json({ error: 'Failed to upload image' });
        }
        
        // Get public URL
        const { data: urlData } = supabase
          .storage
          .from('images')
          .getPublicUrl(fileName);
        
        const imageUrl = urlData.publicUrl;
        
        // Insert into event_gallery table with timeout
        const { data: galleryData, error: insertError } = await withTimeout(
          supabase
            .from('event_gallery')
            .insert([
              {
                event_id: eventId,
                image_url: imageUrl,
                caption: caption
              }
            ])
            .select(),
          10000 // 10 second timeout
        );
        
        if (insertError) {
          console.error('Error inserting gallery image:', insertError);
          return res.status(500).json({ error: 'Failed to save gallery image' });
        }
        
        return res.status(200).json({ image: galleryData[0] });
      } catch (error) {
        console.error('Error handling image upload:', error);
        const isTimeout = error.message && error.message.includes('timed out');
        
        if (isTimeout) {
          return res.status(504).json({ error: 'Upload operation timed out' });
        }
        
        return res.status(error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 500)
          .json({ error: error.message || 'Failed to upload image' });
      }
    }
    
    // DELETE: Remove an image from the gallery
    else if (req.method === 'DELETE') {
      try {
        // For DELETE requests with the bodyParser disabled, we need to manually read the body
        const imageId = req.query.imageId;
        
        if (!imageId) {
          return res.status(400).json({ error: 'Image ID is required' });
        }
        
        // Verify admin status with timeout
        await withTimeout(authenticateAdmin({
          Authorization: req.headers.authorization,
          Cookie: req.headers.cookie
        }), 10000);
        
        // First get the image info to find the storage path with timeout
        const { data: imageData, error: fetchError } = await withTimeout(
          supabase
            .from('event_gallery')
            .select('*')
            .eq('id', imageId)
            .single(),
          10000 // 10 second timeout
        );
        
        if (fetchError || !imageData) {
          return res.status(404).json({ error: 'Image not found' });
        }
        
        // Extract file name from URL
        const fileName = imageData.image_url.split('/').pop();
        
        // Remove from storage with timeout
        const { error: storageError } = await withTimeout(
          supabase
            .storage
            .from('images')
            .remove([fileName]),
          15000 // 15 second timeout
        );
        
        if (storageError) {
          console.error('Error removing file from storage:', storageError);
          // Continue to remove from DB even if storage remove fails
        }
        
        // Remove from database with timeout
        const { error: deleteError } = await withTimeout(
          supabase
            .from('event_gallery')
            .delete()
            .eq('id', imageId),
          10000 // 10 second timeout
        );
        
        if (deleteError) {
          console.error('Error deleting gallery image:', deleteError);
          return res.status(500).json({ error: 'Failed to delete gallery image' });
        }
        
        return res.status(200).json({ success: true, message: 'Image deleted successfully' });
      } catch (error) {
        console.error('Error handling image deletion:', error);
        const isTimeout = error.message && error.message.includes('timed out');
        
        if (isTimeout) {
          return res.status(504).json({ error: 'Delete operation timed out' });
        }
        
        return res.status(error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 500)
          .json({ error: error.message || 'Failed to delete image' });
      }
    }
    
    // Method not allowed
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Unexpected error in API handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 