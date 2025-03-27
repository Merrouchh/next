import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Disable the default body parser for POST requests to handle form data
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

// Helper function to authenticate and verify admin status
const authenticateAdmin = async (supabase) => {
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
};

export default async function handler(req, res) {
  // Create a Supabase client with the auth token from the request
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: req.headers.authorization,
        Cookie: req.headers.cookie
      }
    }
  });

  // GET: Fetch gallery images for an event
  if (req.method === 'GET') {
    try {
      const { eventId } = req.query;
      
      if (!eventId) {
        return res.status(400).json({ error: 'Event ID is required' });
      }
      
      // Fetch all gallery images for this event
      const { data, error } = await supabase
        .from('event_gallery')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching gallery images:', error);
        return res.status(500).json({ error: 'Failed to fetch gallery images' });
      }
      
      return res.status(200).json({ images: data });
    } catch (error) {
      console.error('Error handling gallery fetch:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  // POST: Upload a new image to event gallery
  else if (req.method === 'POST') {
    try {
      // Verify admin status
      await authenticateAdmin(supabase);
      
      // Parse form data
      const { fields, files } = await parseForm(req);
      
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
      
      // Upload to Supabase Storage
      const { data, error } = await supabase
        .storage
        .from('images')
        .upload(fileName, fileContent, {
          contentType: file.mimetype,
          upsert: true
        });
      
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
      
      // Insert into event_gallery table
      const { data: galleryData, error: insertError } = await supabase
        .from('event_gallery')
        .insert([
          {
            event_id: eventId,
            image_url: imageUrl,
            caption: caption
          }
        ])
        .select();
      
      if (insertError) {
        console.error('Error inserting gallery image:', insertError);
        return res.status(500).json({ error: 'Failed to save gallery image' });
      }
      
      return res.status(200).json({ image: galleryData[0] });
    } catch (error) {
      console.error('Error handling image upload:', error);
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
      
      // Verify admin status
      await authenticateAdmin(supabase);
      
      // First get the image info to find the storage path
      const { data: imageData, error: fetchError } = await supabase
        .from('event_gallery')
        .select('*')
        .eq('id', imageId)
        .single();
      
      if (fetchError || !imageData) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Extract file name from URL
      const fileName = imageData.image_url.split('/').pop();
      
      // Remove from storage
      const { error: storageError } = await supabase
        .storage
        .from('images')
        .remove([fileName]);
      
      if (storageError) {
        console.error('Error removing file from storage:', storageError);
        // Continue to remove from DB even if storage remove fails
      }
      
      // Remove from database
      const { error: deleteError } = await supabase
        .from('event_gallery')
        .delete()
        .eq('id', imageId);
      
      if (deleteError) {
        console.error('Error deleting gallery image:', deleteError);
        return res.status(500).json({ error: 'Failed to delete gallery image' });
      }
      
      return res.status(200).json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
      console.error('Error handling image deletion:', error);
      return res.status(error.message.includes('Unauthorized') ? 401 : error.message.includes('Forbidden') ? 403 : 500)
        .json({ error: error.message || 'Failed to delete image' });
    }
  }
  
  // Method not allowed
  else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 