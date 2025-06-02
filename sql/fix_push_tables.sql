-- Fix for push_subscriptions table - Add missing components

-- 1. Add the missing user_id column
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- 2. Add missing index for user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id 
ON public.push_subscriptions(user_id);

-- 3. Create the missing user_queue_positions table
CREATE TABLE IF NOT EXISTS public.user_queue_positions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  position INTEGER NOT NULL,
  computer_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Add indexes for user_queue_positions
CREATE INDEX IF NOT EXISTS idx_user_queue_positions_user_id 
ON public.user_queue_positions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_queue_positions_position 
ON public.user_queue_positions(position);

-- 5. Create trigger for user_queue_positions (fixed syntax)
DROP TRIGGER IF EXISTS update_user_queue_positions_updated_at ON public.user_queue_positions;
CREATE TRIGGER update_user_queue_positions_updated_at
    BEFORE UPDATE ON public.user_queue_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable RLS (Row Level Security) on both tables
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_queue_positions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for push_subscriptions (proper type casting)
DROP POLICY IF EXISTS push_subscriptions_user_policy ON public.push_subscriptions;
CREATE POLICY push_subscriptions_user_policy ON public.push_subscriptions
    FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS push_subscriptions_service_policy ON public.push_subscriptions;
CREATE POLICY push_subscriptions_service_policy ON public.push_subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- 8. Create RLS policies for user_queue_positions (proper type casting)
DROP POLICY IF EXISTS user_queue_positions_user_policy ON public.user_queue_positions;
CREATE POLICY user_queue_positions_user_policy ON public.user_queue_positions
    FOR ALL USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS user_queue_positions_service_policy ON public.user_queue_positions;
CREATE POLICY user_queue_positions_service_policy ON public.user_queue_positions
    FOR ALL USING (auth.role() = 'service_role');

-- 9. Verify the tables are set up correctly
SELECT 'push_subscriptions table columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'user_queue_positions table columns:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_queue_positions' 
AND table_schema = 'public'
ORDER BY ordinal_position; 