-- Web Push Notification Tables for Supabase (PostgreSQL)

-- Table for storing push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255), -- Supabase user ID
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_ip INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Table for tracking user queue positions (for detecting changes)
CREATE TABLE IF NOT EXISTS user_queue_positions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  position INTEGER NOT NULL,
  computer_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_subscription_id ON push_subscriptions(subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_queue_positions_user_id ON user_queue_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_queue_positions_position ON user_queue_positions(position);

-- Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_queue_positions_updated_at ON user_queue_positions;
CREATE TRIGGER update_user_queue_positions_updated_at
    BEFORE UPDATE ON user_queue_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies for security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_queue_positions ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own push subscriptions
CREATE POLICY push_subscriptions_user_policy ON push_subscriptions
    FOR ALL USING (auth.uid()::text = user_id);

-- Users can only see/modify their own queue positions
CREATE POLICY user_queue_positions_user_policy ON user_queue_positions
    FOR ALL USING (auth.uid()::text = user_id);

-- Allow service role to access all records (for server-side operations)
CREATE POLICY push_subscriptions_service_policy ON push_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY user_queue_positions_service_policy ON user_queue_positions
    FOR ALL USING (auth.role() = 'service_role'); 