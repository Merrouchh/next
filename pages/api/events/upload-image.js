import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData || !userData.is_admin) {
      console.error('Admin check error:', userError);
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication error' });
  }

  // Parse form data
  const form = new formidable.IncomingForm();
  form.keepExtensions = true;
  
  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form:', err);
        res.status(500).json({ error: 'Failed to parse form data' });
        return resolve();
      }
      
      try {
        const eventId = fields.eventId;
        const file = files.image;
        
        if (!file) {
          res.status(400).json({ error: 'No image file provided' });
          return resolve();
        }
        
        if (!eventId) {
          res.status(400).json({ error: 'Event ID is required' });
          return resolve();
        }
        
        // Read file
        const fileContent = fs.readFileSync(file.filepath);
        const fileName = `event-${eventId}-${Date.now()}${path.extname(file.originalFilename)}`;
        
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
          res.status(500).json({ error: 'Failed to upload image' });
          return resolve();
        }
        
        // Get public URL
        const { data: urlData } = supabase
          .storage
          .from('images')
          .getPublicUrl(fileName);
        
        const imageUrl = urlData.publicUrl;
        
        // Update event with image URL
        const { data: eventData, error: fetchError } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
        
        if (fetchError) {
          console.error('Error fetching event data:', fetchError);
          res.status(500).json({ error: 'Failed to fetch event data' });
          return resolve();
        }
        
        // Update event with image URL while preserving other fields
        const { error: updateError } = await supabase
          .from('events')
          .update({ 
            image: imageUrl,
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            time: eventData.time,
            location: eventData.location,
            game: eventData.game,
            status: eventData.status
          })
          .eq('id', eventId);
        
        if (updateError) {
          console.error('Error updating event with image URL:', updateError);
          res.status(500).json({ error: 'Failed to update event with image URL' });
          return resolve();
        }
        
        res.status(200).json({ imageUrl });
        return resolve();
      } catch (error) {
        console.error('Error handling image upload:', error);
        res.status(500).json({ error: 'Failed to upload image' });
        return resolve();
      }
    });
  });
} 