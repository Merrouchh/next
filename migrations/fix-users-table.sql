-- Add points column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'points'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN points INTEGER DEFAULT 0 NOT NULL;
        
        RAISE NOTICE 'Added points column to users table';
    ELSE
        RAISE NOTICE 'Points column already exists in users table';
    END IF;
END $$;

-- Check if all users have a points value and set to 0 if null
UPDATE users SET points = 0 WHERE points IS NULL;

-- Make sure RLS is enabled for users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for the users table if they don't exist
DROP POLICY IF EXISTS "Users can read other users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;

-- Allow users to read any user record
CREATE POLICY "Users can read other users"
ON users FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow users to update their own record only
CREATE POLICY "Users can update their own record"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Allow admins to do anything
CREATE POLICY "Admins have full access"
ON users
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.is_admin = true
    )
);

-- Also create read policies for public users
DROP POLICY IF EXISTS "Anyone can read public user profiles" ON users;
CREATE POLICY "Anyone can read public user profiles"
ON users FOR SELECT
USING (true);

-- Log all users with their current points for debugging
SELECT id, username, points FROM users ORDER BY points DESC;

-- Rebuild the user_achievements constraints to ensure they work
DO $$
BEGIN
    -- First try to drop the constraint if it exists
    BEGIN
        ALTER TABLE user_achievements DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_id_key;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping constraint: %', SQLERRM;
    END;
    
    -- Then recreate it
    BEGIN
        ALTER TABLE user_achievements
        ADD CONSTRAINT user_achievements_user_id_achievement_id_key
        UNIQUE (user_id, achievement_id);
        RAISE NOTICE 'Created unique constraint on user_achievements';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error creating constraint: %', SQLERRM;
    END;
END $$; 