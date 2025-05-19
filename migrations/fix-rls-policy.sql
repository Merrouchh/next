-- First, enable RLS on the table
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON user_achievements;
DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can create their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can update their own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Admins can manage all achievements" ON user_achievements;

-- Create a simple policy that allows all authenticated users to access the table
CREATE POLICY "Allow all access to authenticated users"
ON user_achievements
USING (auth.role() = 'authenticated');

-- Wait 1 second to ensure the policy is applied
SELECT pg_sleep(1);

-- Check if the table has a unique constraint on user_id and achievement_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'user_achievements'::regclass
        AND conname = 'user_achievements_user_id_achievement_id_key'
    ) THEN
        -- Add a unique constraint to prevent duplicates and make upsert work
        ALTER TABLE user_achievements
        ADD CONSTRAINT user_achievements_user_id_achievement_id_key
        UNIQUE (user_id, achievement_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding constraint: %', SQLERRM;
END $$; 