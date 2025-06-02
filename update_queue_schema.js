import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSchema() {
  try {
    console.log('Adding user_id column to computer_queue table...');
    
    // Add the user_id column if it doesn't exist
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='computer_queue' AND column_name='user_id') THEN
            ALTER TABLE public.computer_queue ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
            RAISE NOTICE 'user_id column added successfully';
          ELSE
            RAISE NOTICE 'user_id column already exists';
          END IF;
        END $$;
      `
    });

    if (error) {
      console.error('Error updating schema:', error);
    } else {
      console.log('Schema update completed successfully');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

updateSchema(); 