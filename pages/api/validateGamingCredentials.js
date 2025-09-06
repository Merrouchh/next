// pages/api/validateGamingCredentials.js
// This endpoint allows unauthenticated users to validate gaming credentials for account linking
import { withRateLimit } from '../../utils/middleware/rateLimiting';
import { createClient } from '@supabase/supabase-js';

async function handler(req, res) {
    // SECURITY: Remove dangerous CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || 'https://merrouchgaming.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { username, password } = req.body;
  
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
  
    const apiUrl = `${process.env.API_BASE_URL}/users/${encodeURIComponent(username)}/${encodeURIComponent(password)}/valid`;
  
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: 'Basic ' + Buffer.from(process.env.API_AUTH).toString('base64'),
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        return res.status(response.status).json({ 
          message: 'Failed to fetch user credentials',
          status: response.status,
          isError: true
        });
      }
  
      const data = await response.json();
      console.log(`[AUDIT] Gaming credentials validated for ${username}`);
      
      // Check if the gaming credentials are valid and get the user ID
      if (data.result && data.result.identity && data.result.identity.userId) {
        const gizmoId = data.result.identity.userId;
        
        try {
          // Create Supabase client with environment variables
          const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
          );
          
          // Check if this gizmo_id is already linked to a website account
          const { data: existingUser, error: userError } = await supabase
            .from('users')
            .select('id, username, email')
            .eq('gizmo_id', gizmoId)
            .single();
            
          if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('Error checking for existing user:', userError);
          } else if (existingUser) {
            // Gaming account is already linked
            console.log(`[AUDIT] Gaming account ${username} (ID: ${gizmoId}) is already linked to website account ${existingUser.username}`);
            return res.status(200).json({
              ...data,
              alreadyLinked: true,
              linkedAccount: {
                username: existingUser.username,
                email: existingUser.email
              }
            });
          }
        } catch (dbError) {
          console.error('Database error checking for existing user:', dbError);
          // Continue with normal flow even if DB check fails
        }
      }
  
      // Pass the data back to the client
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in validateGamingCredentials:', error);
      return res.status(500).json({ 
        message: error.name === 'AbortError' 
          ? 'Request timed out' 
          : 'Internal Server Error',
        isError: true
      });
    }
}

// Export with rate limiting (no auth required)
export default withRateLimit(handler, 'general');
