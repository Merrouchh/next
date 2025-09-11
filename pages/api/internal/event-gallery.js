import { createClient } from '@supabase/supabase-js';

/**
 * Internal API for event gallery operations
 * This API handles authentication server-side and calls the original APIs internally
 * This prevents authorization headers from being exposed to the client
 */
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Check if this is FormData (image upload) or JSON (other operations)
    const contentType = req.headers['content-type'];
    
    if (contentType && contentType.includes('multipart/form-data')) {
      // Handle image upload with FormData
      return await handleUploadImage(req, res);
    } else {
      // Handle other operations with JSON
      const { action, galleryData } = req.body;

      // Basic validation
      if (!action) {
        return res.status(400).json({ 
          error: 'Invalid request parameters',
          details: 'action is required'
        });
      }

      // Create Supabase client with service role key for server-side operations
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // Get user data to verify they exist
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, username, is_admin, is_staff')
        .eq('id', req.body.userId)
        .single();

      if (userError || !userData) {
        console.error('Error getting user data:', userError);
        return res.status(404).json({ 
          success: false,
          error: 'User not found',
          message: 'Unable to verify user identity'
        });
      }

      // Route to appropriate handler based on action
      switch (action) {
        case 'delete':
          return await handleDeleteImage(req, res, galleryData);
        default:
          return res.status(400).json({ 
            success: false,
            error: 'Invalid action',
            details: 'Action must be one of: delete'
          });
      }
    }

  } catch (error) {
    console.error('[INTERNAL API] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to process event gallery request'
    });
  }
}

// Upload image
async function handleUploadImage(req, res) {
  try {
    // Forward the FormData directly to the gallery API
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/events/gallery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: req.body
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[INTERNAL API] Non-JSON response from upload image API:', text);
      return res.status(500).json({
        success: false,
        error: 'Invalid response from upload image API',
        message: 'Expected JSON response but got: ' + contentType
      });
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Upload image error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload image',
      message: 'Internal server error'
    });
  }
}

// Delete image
async function handleDeleteImage(req, res, galleryData) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const imageId = galleryData?.imageId;
    
    if (!imageId) {
      return res.status(400).json({
        success: false,
        error: 'Image ID is required'
      });
    }
    
    const response = await fetch(`${baseUrl}/api/events/gallery?imageId=${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[INTERNAL API] Delete image error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete image',
      message: 'Internal server error'
    });
  }
}

export default handler;