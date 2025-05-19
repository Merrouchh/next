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
        
        -- Add comment for documentation
        COMMENT ON COLUMN users.points IS 'Points earned from achievements and other activities';
    END IF;
END $$;

-- Create a function to safely add points to a user
CREATE OR REPLACE FUNCTION add_user_points(user_id UUID, points_to_add INTEGER)
RETURNS INTEGER AS $$
DECLARE
    new_total INTEGER;
BEGIN
    UPDATE users
    SET points = COALESCE(points, 0) + points_to_add
    WHERE id = user_id
    RETURNING points INTO new_total;
    
    RETURN new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to safely deduct points from a user (only if they have enough)
CREATE OR REPLACE FUNCTION deduct_user_points(user_id UUID, points_to_deduct INTEGER)
RETURNS INTEGER AS $$
DECLARE
    current_points INTEGER;
    new_total INTEGER;
BEGIN
    -- Get current points
    SELECT points INTO current_points
    FROM users
    WHERE id = user_id;
    
    -- Check if user has enough points
    IF current_points >= points_to_deduct THEN
        UPDATE users
        SET points = points - points_to_deduct
        WHERE id = user_id
        RETURNING points INTO new_total;
        
        RETURN new_total;
    ELSE
        RAISE EXCEPTION 'Insufficient points. User has % points, trying to deduct %', current_points, points_to_deduct;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for user_achievements table
DO $$ 
BEGIN
    -- Enable RLS on user_achievements if not already enabled
    ALTER TABLE IF EXISTS user_achievements ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
    DROP POLICY IF EXISTS "Users can create their own achievements" ON user_achievements;
    DROP POLICY IF EXISTS "Users can update their own achievements" ON user_achievements;
    DROP POLICY IF EXISTS "Admins can manage all achievements" ON user_achievements;
    
    -- Create policies
    CREATE POLICY "Users can view their own achievements"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can create their own achievements"
    ON user_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own achievements"
    ON user_achievements FOR UPDATE
    USING (auth.uid() = user_id);
    
    CREATE POLICY "Admins can manage all achievements"
    ON user_achievements
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );
END $$; 