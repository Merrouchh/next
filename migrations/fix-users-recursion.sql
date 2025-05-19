-- First disable Row Level Security on users table temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Add points column if missing
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
    END IF;
END $$;

-- Set null points to 0
UPDATE users SET points = 0 WHERE points IS NULL;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can read other users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;
DROP POLICY IF EXISTS "Anyone can read public user profiles" ON users;

-- Re-enable RLS with bypass for postgres role
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Create simplified policy: allow all read access
CREATE POLICY "Allow read access to all users"
ON users FOR SELECT
USING (true);

-- Create simplified policy: users can update themselves
CREATE POLICY "Users can update themselves"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Create a simple table for testing points
CREATE TABLE IF NOT EXISTS test_points (
    test_id SERIAL PRIMARY KEY,
    message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a test record
INSERT INTO test_points (message) VALUES ('Points system reset');

-- Output all users with their current points
SELECT id, username, points FROM users ORDER BY points DESC; 