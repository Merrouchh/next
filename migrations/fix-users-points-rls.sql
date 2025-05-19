-- Ensure points permissions work correctly
-- First, disable Row Level Security temporarily to make changes
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Make sure points column exists and has correct default
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
    ELSE
        -- Make sure it has the correct default and nullability
        ALTER TABLE users 
        ALTER COLUMN points SET DEFAULT 0,
        ALTER COLUMN points SET NOT NULL;
    END IF;
END $$;

-- Set null points to 0
UPDATE users SET points = 0 WHERE points IS NULL;

-- Drop all existing policies to recreate them
DROP POLICY IF EXISTS "Users can read other users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;
DROP POLICY IF EXISTS "Anyone can read public user profiles" ON users;
DROP POLICY IF EXISTS "Allow read access to all users" ON users;
DROP POLICY IF EXISTS "Users can update themselves" ON users;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create broad read access policy
CREATE POLICY "Allow read access to all users"
ON users FOR SELECT
USING (true);

-- Create update policy with broader permissions
CREATE POLICY "Users can update themselves"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create policy specifically for points update
CREATE POLICY "Users can update their own points"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Additional policy for admins
CREATE POLICY "Admins have full access"
ON users FOR ALL
USING (auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true
));

-- Test updates with a database function
CREATE OR REPLACE FUNCTION test_points_update(user_id UUID, points_to_add INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_points INTEGER;
    new_total INTEGER;
BEGIN
    -- Get current points
    SELECT points INTO current_points
    FROM users
    WHERE id = user_id;
    
    -- Update points
    UPDATE users
    SET points = COALESCE(points, 0) + points_to_add
    WHERE id = user_id
    RETURNING points INTO new_total;
    
    RETURN new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create test_points table if it doesn't exist
CREATE TABLE IF NOT EXISTS test_points (
    test_id SERIAL PRIMARY KEY,
    message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Log update for tracking
INSERT INTO test_points (message) VALUES ('Points system RLS updated');

-- Output current state
SELECT id, username, points FROM users ORDER BY points DESC LIMIT 10; 