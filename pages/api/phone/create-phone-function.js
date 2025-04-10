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

    // SQL to create the function
    const sql = `
      create or replace function clear_user_phone(user_id uuid)
      returns bool
      security definer as $$
      begin
        update auth.users 
        set phone = '',
            phone_confirmed_at = null,
            phone_change = ''
        where id = user_id;
        return true;
      end;
      $$ language plpgsql;
    `;

    // Execute raw SQL query
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('Error creating clear_user_phone function:', error);
      
      // Check if we can use a different approach - direct SQL
      try {
        // Try using the direct SQL query API if available
        const { error: sqlError } = await supabase.auth.admin.executeSql(sql);
        
        if (sqlError) {
          console.error('Error with direct SQL execution:', sqlError);
          return res.status(500).json({ 
            error: 'Failed to create phone clear function',
            details: sqlError
          });
        } else {
          console.log('Successfully created clear_user_phone function using direct SQL');
          return res.status(200).json({ 
            success: true, 
            message: 'Phone clear function created successfully using direct SQL'
          });
        }
      } catch (directSqlError) {
        console.error('Error with direct SQL approach:', directSqlError);
        return res.status(500).json({ 
          error: 'Failed to create phone clear function with both methods',
          details: { rpcError: error, directError: directSqlError }
        });
      }
    }

    console.log('Successfully created clear_user_phone function');
    return res.status(200).json({ 
      success: true, 
      message: 'Phone clear function created successfully'
    });
  } catch (error) {
    console.error('Unexpected error creating phone function:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      message: error.message
    });
  }
} 