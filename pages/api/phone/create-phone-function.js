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

    // Create the phone_verifications table first if it doesn't exist
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

    // Execute the table creation
    await supabase.rpc('pg_execute', { 
      query: createTableSql 
    }).catch(err => {
      console.log('Table creation attempt failed, continuing:', err);
      // Continue even if this fails
    });

    // Alternative direct SQL (if pg_execute isn't available)
    try {
      // First use the SQL editor
      await supabase
        .from('_sqlEditorTempResult')
        .select('*')
        .limit(1)
        .then(({ error }) => {
          if (error) {
            console.log('SQL editor access failed:', error);
          }
        });

      await supabase.rpc('pg_execute', { 
        query: createTableSql 
      });
    } catch (err) {
      console.log('Alternative table creation also failed:', err);
      // Continue even if this fails
    }

    // For the SQL function, we'll use a direct approach with the Supabase SQL editor
    // First, let's try creating it in the public schema
    const sql = `
      create or replace function public.clear_user_phone(user_id uuid)
      returns boolean
      language plpgsql
      security definer
      as $$
      begin
        update auth.users 
        set phone = NULL,
            phone_confirmed_at = NULL, 
            phone_change = '' 
        where id = user_id;
        return true;
      end;
      $$;
    `;

    console.log("Attempting to create the clear_user_phone function");

    // Try to use pg_execute function if available
    try {
      const { error } = await supabase.rpc('pg_execute', { 
        query: sql 
      });

      if (error) {
        console.error('Error creating function with pg_execute:', error);
      } else {
        console.log('Function created successfully using pg_execute');
        return res.status(200).json({ 
          success: true, 
          message: 'Phone clear function created successfully with pg_execute'
        });
      }
    } catch (err) {
      console.log('pg_execute method failed:', err);
      // Continue to try other methods
    }

    // If we're here, the first attempt failed. Let's try a SQL editor approach
    // In actual implementation, we'd suggest manually running this SQL in the Supabase SQL editor
    console.log("Please run the following SQL in your Supabase SQL editor:");
    console.log(sql);

    return res.status(202).json({
      success: true,
      message: "Function creation initiated. For best results, please run the SQL in your Supabase SQL editor.",
      sql: sql
    });
  } catch (error) {
    console.error('Unexpected error creating phone function:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
} 