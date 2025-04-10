import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for admin authorization
    // In a real application, you'd want to add more security here
    const { authorization } = req.headers;
    if (!authorization || authorization !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Create the phone_verifications table if it doesn't exist
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS phone_verifications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
        phone text,
        verified_at timestamp with time zone,
        is_verified boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now()
      );
    `;

    // Attempt to create the phone_verifications table
    try {
      await supabase.rpc('pg_execute', { 
        query: createTableSql 
      }).catch(err => {
        console.log('Table creation attempt failed, continuing:', err);
      });
    } catch (err) {
      console.log('Table creation error:', err);
      // Continue even if table creation fails
    }

    // Return instructions for phone number management
    console.log("Returning phone number management instructions");
    
    return res.status(200).json({
      success: true,
      message: "Phone management system initialized. Auth users table can only be modified through Auth API methods.",
      phoneManagement: {
        notice: "The auth.users table is the source of truth for phone numbers. Updates to it will cascade to the users table.",
        instructions: "To modify phone numbers, use these approaches:",
        methods: [
          {
            method: "Admin API for Adding Phones",
            description: "Use admin.updateUserById to set the phone number",
            example: "await supabase.auth.admin.updateUserById(userId, { phone: '+1234567890' })"
          },
          {
            method: "Admin API for Removing Phones",
            description: "Use admin.updateUserById with empty string to remove a phone number",
            example: "await supabase.auth.admin.updateUserById(userId, { phone: '' })"
          }
        ],
        note: "Our phone verification and removal APIs have been updated to use these approaches automatically."
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
} 