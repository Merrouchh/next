-- Enable RLS on game_time_rewards table to prevent users from deleting their records
-- This prevents users from exploiting the system by deleting their reward record and claiming it again
-- 
-- SECURITY ISSUE: Without RLS, users could:
-- 1. Delete their record from game_time_rewards table using the anon key
-- 2. Call the API again to get another 1-hour reward
--
-- SOLUTION: Enable RLS with strict policies that only allow SELECT operations for users

-- Enable Row Level Security
ALTER TABLE game_time_rewards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own game time rewards" ON game_time_rewards;

-- Policy: Users can only SELECT their own rewards (read-only transparency)
-- This allows users to see their reward history but not modify it
CREATE POLICY "Users can view their own game time rewards"
ON game_time_rewards
FOR SELECT
TO authenticated, anon
USING (user_id = auth.uid());

-- NO INSERT/UPDATE/DELETE POLICIES created for regular users
-- Since RLS is enabled, any operation without a policy is denied by default
-- Service role (used by API) bypasses RLS and can still perform all operations
-- Result: Regular users can only SELECT their own records, nothing else

-- Revoke write permissions from authenticated users and anon (belt and suspenders approach)
REVOKE DELETE ON game_time_rewards FROM authenticated;
REVOKE DELETE ON game_time_rewards FROM anon;
REVOKE INSERT ON game_time_rewards FROM authenticated;
REVOKE INSERT ON game_time_rewards FROM anon;
REVOKE UPDATE ON game_time_rewards FROM authenticated;
REVOKE UPDATE ON game_time_rewards FROM anon;

-- Grant only SELECT permission
GRANT SELECT ON game_time_rewards TO authenticated;
GRANT SELECT ON game_time_rewards TO anon;

COMMENT ON TABLE game_time_rewards IS 'Stores game time rewards given to users. RLS enabled to prevent users from deleting their records and claiming rewards multiple times. Only service role (API) can write to this table.';

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_game_time_rewards_gizmo_id ON game_time_rewards(gizmo_id);
CREATE INDEX IF NOT EXISTS idx_game_time_rewards_user_id ON game_time_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_game_time_rewards_created_at ON game_time_rewards(created_at DESC);

