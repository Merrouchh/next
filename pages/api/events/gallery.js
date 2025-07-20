import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { 
  compressImageForSocialMedia, 
  validateImageFile, 
  generateOptimizedFilename,
  getImageMetadata 
} from '../../../utils/imageCompression';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a singleton Supabase client to enable connection pooling
let supabaseClientSingleton;

function getSupabaseClient(headers = {}) {
  console.log('Creating supabase client with headers:', Object.keys(headers));
  
  // Reset the singleton to ensure we're using a fresh client with the new auth token
  supabaseClientSingleton = null;
  
  // Extract authorization token properly
  const authHeader = headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  
  if (token) {
    console.log('Token found, length:', token.length);
  } else {
    console.log('No token found in headers');
  }
  
  supabaseClientSingleton = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: headers
    },
    // Add reasonable timeout settings
    realtime: {
      timeout: 20000 // 20s for realtime connections
    },
    db: {
      schema: 'public'
    }
  });
  
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
  try {
    console.log("Starting admin authentication check...");
    console.log("Auth headers:", JSON.stringify(Object.keys(authHeaders)));
    
    // Extract token information for debugging
    const authHeader = authHeaders.Authorization || '';
    if (!authHeader) {
      console.log("No Authorization header found");
      throw new Error('Unauthorized: No authorization header');
    }
    
    console.log("Auth header starts with Bearer:", authHeader.startsWith('Bearer '));
    
    // Create new client specifically for this authentication attempt
    const supabase = getSupabaseClient(authHeaders);
    
    // Try getting session first
    console.log("Attempting to get session from auth...");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log("Session error:", sessionError);
    } else {
      console.log("Session data available:", !!sessionData);
      if (sessionData && sessionData.session) {
        console.log("User in session:", sessionData.session.user.id);
      }
    }
    
    // Try getting user directly
    console.log("Getting user data...");
    const { data, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.log("Auth error:", authError);
      
      // If getUser fails, try a different approach with the token
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log("Attempting JWT decode to get user ID...");
        
        try {
          // Try to manually set the session
          const { data: jwtData, error: jwtError } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: '',
          });
          
          if (jwtError) {
            console.log("JWT verification error:", jwtError);
            throw new Error('Unauthorized: Invalid token');
          }
          
          if (jwtData && jwtData.user) {
            console.log("User authenticated via JWT:", jwtData.user.id);
            
            // Check admin status
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('is_admin, username')
              .eq('id', jwtData.user.id)
              .single();
            
            if (userError) {
              console.log("Error getting user data:", userError);
              throw new Error('Failed to verify admin status');
            }
            
            if (!userData || !userData.is_admin) {
              console.log("User is not an admin:", jwtData.user.id);
              throw new Error('Forbidden: Admin access required');
            }
            
            console.log("Admin authentication successful for:", userData.username);
            return jwtData.user;
          } else {
            throw new Error('Unauthorized: No user found in token');
          }
        } catch (tokenError) {
          console.log("Token verification failed:", tokenError);
          throw new Error('Unauthorized: Invalid token');
        }
      } else {
        throw new Error('Unauthorized: Authentication error');
      }
    }

    if (!data || !data.user) {
      console.log("No user found in authentication data");
      throw new Error('Unauthorized: No user found');
    }
    
    const user = data.user;
    console.log("User authenticated:", user.id);
    
    // Then check if the user is an admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin, username')
      .eq('id', user.id)
      .single();
    
    if (userError) {
      console.log("Error getting user data:", userError);
      throw new Error('Failed to verify admin status');
    }
    
    if (!userData) {
      console.log("No user data found for ID:", user.id);
      throw new Error('User not found');
    }
    
    if (!userData.is_admin) {
      console.log("User is not an admin:", user.id, userData.username);
      throw new Error('Forbidden: Admin access required');
    }
    
    console.log("Admin authentication successful for:", userData.username);
    return user;
  } catch (error) {
    console.error('Authentication error:', error.message);
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
      // Cache headers removed
  
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
        console.log('POST request to upload gallery image received');
        console.log('Auth headers present:', !!req.headers.authorization);
        
        // Extract the token directly to debug
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;
        
        if (!bearerToken) {
          console.log('No bearer token found in authorization header');
          return res.status(401).json({ error: 'No authorization token provided' });
        }
        
        // Log token length for debugging
        console.log('Bearer token length:', bearerToken.length);
        
        // Construct headers with all possible auth methods
        const authHeaders = {
          Authorization: `Bearer ${bearerToken}`,
          Cookie: req.headers.cookie || ''
        };
        
        console.log('Attempting admin authentication...');
        
        // Verify admin status
        const user = await withTimeout(authenticateAdmin(authHeaders), 10000);
        
        console.log('Admin authentication successful, processing upload...');
        console.log('Authenticated user ID:', user.id);
        
        // Parse form data with timeout
        let fields, files;
        try {
          const formData = await withTimeout(parseForm(req), 30000);
          fields = formData.fields;
          files = formData.files;
          
          console.log('Form data parsed successfully');
          console.log('Fields received:', Object.keys(fields));
          console.log('Files received:', Object.keys(files));
        } catch (formError) {
          console.error('Error parsing form data:', formError);
          return res.status(400).json({ error: 'Failed to parse form data: ' + formError.message });
        }
        
        const eventId = fields.eventId?.[0] || fields.eventId;
        const caption = fields.caption?.[0] || fields.caption || '';
        const file = files.image?.[0] || files.image;
        
        if (!file) {
          console.log('No image file found in request');
          return res.status(400).json({ error: 'No image file provided' });
        }
        
        if (!eventId) {
          console.log('No eventId found in request');
          return res.status(400).json({ error: 'Event ID is required' });
        }
        
        console.log(`Processing image upload for event ${eventId}...`);
        
        // Validate image file
        console.log('Validating image file...');
        const validation = validateImageFile(file);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }
        
        // Read file
        const filePath = file.filepath || file.path;
        const originalFileContent = fs.readFileSync(filePath);
        const originalFilename = file.originalFilename || file.name;
        
        // Get original image metadata
        console.log('Getting original image metadata...');
        const originalMetadata = await getImageMetadata(originalFileContent);
        console.log('Original gallery image:', {
          size: `${(originalMetadata.size / 1024).toFixed(1)}KB`,
          dimensions: `${originalMetadata.width}x${originalMetadata.height}`,
          format: originalMetadata.format
        });

        // Compress image for social media optimization
        console.log('Compressing gallery image for social media optimization...');
        const compressedFileContent = await compressImageForSocialMedia(originalFileContent);
        
        // Get compressed image metadata
        const compressedMetadata = await getImageMetadata(compressedFileContent);
        console.log('Compressed gallery image:', {
          size: `${(compressedMetadata.size / 1024).toFixed(1)}KB`,
          dimensions: `${compressedMetadata.width}x${compressedMetadata.height}`,
          format: compressedMetadata.format,
          compressionRatio: `${((1 - compressedMetadata.size / originalMetadata.size) * 100).toFixed(1)}%`
        });

        // Generate optimized filename
        const fileName = generateOptimizedFilename(originalFilename, `gallery-${eventId}`, 'jpg');
        
        console.log(`Uploading optimized gallery image: ${fileName}, size: ${compressedFileContent.length} bytes`);
        
        // Upload compressed image to Supabase Storage with timeout
        const { data, error } = await withTimeout(
          supabase
            .storage
            .from('images')
            .upload(fileName, compressedFileContent, {
              contentType: 'image/jpeg',
              upsert: true
            }),
          30000 // 30 second timeout for upload
        );
        
        if (error) {
          console.error('Error uploading to Supabase:', error);
          return res.status(500).json({ error: 'Failed to upload image' });
        }
        
        console.log('Image uploaded to storage successfully');
        
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
        
        console.log('Gallery image saved to database successfully');
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
        console.log('DELETE request to remove gallery image received');
        
        const { imageId } = req.query;
        
        if (!imageId) {
          console.log('No imageId provided in query parameters');
          return res.status(400).json({ error: 'Image ID is required' });
        }
        
        console.log('Deleting image with ID:', imageId);
        
        // Extract the token directly to debug
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : authHeader;
        
        if (!bearerToken) {
          console.log('No bearer token found in authorization header for DELETE');
          return res.status(401).json({ error: 'No authorization token provided' });
        }
        
        console.log('DELETE - Bearer token length:', bearerToken.length);
        
        // Construct headers with all possible auth methods
        const authHeaders = {
          Authorization: `Bearer ${bearerToken}`,
          Cookie: req.headers.cookie || ''
        };
        
        console.log('Attempting admin authentication for delete...');
        
        // Verify admin status
        const user = await withTimeout(authenticateAdmin(authHeaders), 10000);
        
        console.log('Admin authentication successful, processing delete...');
        console.log('Authenticated user ID for delete:', user.id);
        
        // Get image URL first
        const { data: imageData, error: getError } = await withTimeout(
          supabase
            .from('event_gallery')
            .select('image_url, event_id')
            .eq('id', imageId)
            .single(),
          10000
        );
        
        if (getError) {
          console.error('Error fetching image data:', getError);
          return res.status(500).json({ error: 'Failed to fetch image data' });
        }
        
        if (!imageData) {
          console.log('Image not found with ID:', imageId);
          return res.status(404).json({ error: 'Image not found' });
        }
        
        console.log(`Found image for event ${imageData.event_id} with URL: ${imageData.image_url}`);
        
        // Extract storage filename from URL
        const url = new URL(imageData.image_url);
        const pathname = decodeURIComponent(url.pathname);
        const filename = pathname.split('/').pop();
        
        console.log(`Deleting image ${filename} from storage...`);
        
        // Delete from storage first
        if (filename) {
          const { error: storageError } = await withTimeout(
            supabase
              .storage
              .from('images')
              .remove([filename]),
            20000
          );
          
          if (storageError) {
            console.warn('Error removing image from storage:', storageError);
            // Continue anyway, storage cleanup can be done later if needed
          } else {
            console.log('Image successfully removed from storage');
          }
        } else {
          console.warn('Could not parse filename from URL:', imageData.image_url);
        }
        
        // Delete from database
        const { error: deleteError } = await withTimeout(
          supabase
            .from('event_gallery')
            .delete()
            .eq('id', imageId),
          10000
        );
        
        if (deleteError) {
          console.error('Error deleting image from database:', deleteError);
          return res.status(500).json({ error: 'Failed to delete image from database' });
        }
        
        console.log('Gallery image successfully deleted');
        return res.status(200).json({ message: 'Image successfully deleted' });
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