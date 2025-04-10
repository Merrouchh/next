import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  // Check admin authorization token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Verify admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.split(' ')[1]
    );
    
    if (authError || !user) {
      return res.status(401).json({ message: 'Unauthorized', error: authError?.message });
    }
    
    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError || !userData || !userData.is_admin) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    
    console.log('Starting migration: Adding phone_verification_required column to events table');
    
    // Execute the SQL to add the column
    const { error: migrationError } = await supabase.rpc('execute_sql', {
      sql: `
        -- Add phone_verification_required column to the events table
        ALTER TABLE public.events 
        ADD COLUMN IF NOT EXISTS phone_verification_required BOOLEAN DEFAULT true;
        
        -- Add comment explaining the column
        COMMENT ON COLUMN public.events.phone_verification_required IS 'Determines if phone verification is required for event registration';
        
        -- Update existing events to have phone verification disabled by default
        -- This ensures backward compatibility with existing events
        UPDATE public.events 
        SET phone_verification_required = false
        WHERE phone_verification_required IS NULL;
      `
    });
    
    if (migrationError) {
      console.error('Migration error:', migrationError);
      return res.status(500).json({ 
        message: 'Error executing migration', 
        error: migrationError.message 
      });
    }
    
    console.log('Migration completed successfully');
    
    return res.status(200).json({ 
      message: 'Migration successful: Added phone_verification_required column to events table',
      success: true
    });
    
  } catch (error) {
    console.error('Error in migration:', error);
    return res.status(500).json({ 
      message: 'Internal server error executing migration', 
      error: error.message 
    });
  }
} 