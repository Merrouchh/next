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
    
    console.log('Starting migration: Creating event_registration_locks table');
    
    // Create the event_registration_locks table
    const { error: createTableError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.event_registration_locks (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          CONSTRAINT event_registration_locks_user_partner_event_key UNIQUE (user_id, partner_id, event_id)
        );
        
        -- Add index for faster lookups
        CREATE INDEX IF NOT EXISTS event_registration_locks_user_id_idx ON public.event_registration_locks(user_id);
        CREATE INDEX IF NOT EXISTS event_registration_locks_partner_id_idx ON public.event_registration_locks(partner_id);
        CREATE INDEX IF NOT EXISTS event_registration_locks_event_id_idx ON public.event_registration_locks(event_id);
        
        -- Add function to clean expired locks
        CREATE OR REPLACE FUNCTION clean_expired_locks() RETURNS void AS $$
        BEGIN
          DELETE FROM public.event_registration_locks WHERE expires_at < now();
        END;
        $$ LANGUAGE plpgsql;
        
        -- Create transaction functions if they don't exist
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'begin_transaction') THEN
            CREATE OR REPLACE FUNCTION begin_transaction() RETURNS void AS $$
            BEGIN
              -- Begin transaction is implicit in PostgreSQL functions
              -- This is just a placeholder for API usage
            END;
            $$ LANGUAGE plpgsql;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'commit_transaction') THEN
            CREATE OR REPLACE FUNCTION commit_transaction() RETURNS void AS $$
            BEGIN
              -- Commit transaction is implicit when function completes
              -- This is just a placeholder for API usage
            END;
            $$ LANGUAGE plpgsql;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rollback_transaction') THEN
            CREATE OR REPLACE FUNCTION rollback_transaction() RETURNS void AS $$
            BEGIN
              -- Issue a ROLLBACK command
              RAISE EXCEPTION 'Transaction rolled back';
            END;
            $$ LANGUAGE plpgsql;
          END IF;
        END;
        $$;
      `
    });
    
    if (createTableError) {
      console.error('Error creating event_registration_locks table:', createTableError);
      return res.status(500).json({ error: createTableError.message });
    }
    
    // Create a scheduled job to clean expired locks if using pg_cron (optional)
    // If you have pg_cron extension enabled
    try {
      await supabase.rpc('execute_sql', {
        sql: `
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
              SELECT cron.schedule('clean_expired_locks_job', '* * * * *', 'SELECT clean_expired_locks()');
            END IF;
          END;
          $$;
        `
      });
    } catch {
      console.log('Note: pg_cron extension not available, skipping scheduled cleaning job');
      // Continue without error, this is optional
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Successfully created event_registration_locks table' 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
} 