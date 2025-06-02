-- Quick fix for production push notification issues
-- Run this in your Supabase SQL editor

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
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

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_subscription_id ON push_subscriptions(subscription_id);

-- 3. Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Create service role policy (allows server-side operations)
DROP POLICY IF EXISTS push_subscriptions_service_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_service_policy ON push_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- 5. Create user policy (allows users to manage their own subscriptions)
DROP POLICY IF EXISTS push_subscriptions_user_policy ON push_subscriptions;
CREATE POLICY push_subscriptions_user_policy ON push_subscriptions
    FOR ALL USING (auth.uid()::text = user_id);

-- 6. Verify table exists and check current data
SELECT 'Table created successfully. Current subscription count:' as status;
SELECT COUNT(*) as total_subscriptions FROM push_subscriptions;
SELECT 'Sample columns:' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions' 
ORDER BY ordinal_position; 