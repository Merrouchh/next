import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Create storage bucket request received');

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
    // Create a Supabase client with the service role key for admin operations
    // This bypasses RLS policies
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if the bucket already exists
    console.log('Checking if images bucket exists...');
    const { data: buckets, error: listError } = await adminSupabase
      .storage
      .listBuckets();
      
    if (listError) {
      console.error('Error listing buckets:', listError);
      return res.status(500).json({ error: 'Failed to list buckets', details: listError.message });
    }
    
    const imagesBucket = buckets.find(b => b.name === 'images');
    
    if (imagesBucket) {
      console.log('Images bucket already exists');
      
      // Update bucket to be public
      console.log('Updating bucket to be public...');
      const { error: updateError } = await adminSupabase
        .storage
        .updateBucket('images', {
          public: true
        });
        
      if (updateError) {
        console.error('Error updating bucket:', updateError);
        return res.status(500).json({ error: 'Failed to update bucket', details: updateError.message });
      }
      
      console.log('Bucket updated successfully');
      return res.status(200).json({ message: 'Bucket already exists and was updated to be public' });
    }
    
    // Create the bucket
    console.log('Creating images bucket...');
    const { data, error: createError } = await adminSupabase
      .storage
      .createBucket('images', {
        public: true
      });
      
    if (createError) {
      console.error('Error creating bucket:', createError);
      return res.status(500).json({ error: 'Failed to create bucket', details: createError.message });
    }
    
    console.log('Bucket created successfully');
    
    // Set up RLS policies for the bucket
    console.log('Setting up RLS policies...');
    
    // Allow public read access
    const { error: policyError1 } = await adminSupabase
      .storage
      .from('images')
      .createPolicy('Public Read Access', {
        name: 'Public Read Access',
        definition: {
          type: 'READ',
          match: { prefix: '' }
        }
      });
      
    if (policyError1) {
      console.error('Error creating read policy:', policyError1);
      // Continue anyway - the bucket is created
    }
    
    // Allow admin write access
    const { error: policyError2 } = await adminSupabase
      .storage
      .from('images')
      .createPolicy('Admin Write Access', {
        name: 'Admin Write Access',
        definition: {
          type: 'WRITE',
          match: { prefix: '' },
          roles: ['authenticated'],
          check: "auth.uid() IN (SELECT id FROM users WHERE is_admin = true)"
        }
      });
      
    if (policyError2) {
      console.error('Error creating write policy:', policyError2);
      // Continue anyway - the bucket is created
    }
    
    return res.status(200).json({ message: 'Bucket created successfully' });
  } catch (error) {
    console.error('Error creating bucket:', error);
    return res.status(500).json({ error: 'Failed to create bucket', details: error.message });
  }
} 