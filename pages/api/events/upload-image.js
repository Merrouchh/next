import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    
    // Check if the bucket exists
    console.log('Checking if storage bucket exists...');
    try {
      const { data: buckets, error: bucketError } = await supabase
        .storage
        .listBuckets();
        
      if (bucketError) {
        console.error('Error listing buckets:', bucketError);
        // Continue anyway - the bucket might exist but the user doesn't have permission to list buckets
        console.log('Continuing with upload despite bucket listing error');
      } else {
        const imagesBucket = buckets.find(b => b.name === 'images');
        if (!imagesBucket) {
          console.log('Images bucket not found in the list, but it might exist with restricted access');
        } else {
          console.log('Images bucket exists');
        }
      }
    } catch (error) {
      console.error('Error checking buckets:', error);
      // Continue anyway - we'll try to upload directly
      console.log('Continuing with upload despite bucket check error');
    }
    
    // Read file
    console.log('Reading file content...');
    const filePath = file.filepath || file.path;
    const fileContent = fs.readFileSync(filePath);
    const originalFilename = file.originalFilename || file.name;
    const fileExt = path.extname(originalFilename);
    const fileName = `event-${eventId}-${Date.now()}${fileExt}`;
    
    console.log('Uploading to Supabase Storage:', { fileName, contentType: file.mimetype });
    
    // Upload to Supabase Storage - assume the bucket already exists
    const { data, error } = await supabase
      .storage
      .from('images')
      .upload(fileName, fileContent, {
        contentType: file.mimetype,
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