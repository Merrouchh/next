-- Fix Missing automatic_mode Field
-- This ensures the automatic_mode column exists and get_queue_status returns proper format

-- 1. Add automatic_mode column if it doesn't exist
ALTER TABLE public.queue_settings 
ADD COLUMN IF NOT EXISTS automatic_mode BOOLEAN DEFAULT false;

-- 2. Update existing records to have automatic_mode = false if NULL
UPDATE public.queue_settings 
SET automatic_mode = false 
WHERE automatic_mode IS NULL;

-- 3. Drop the existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_queue_status();

-- 4. Create the fixed get_queue_status function to return proper format
CREATE OR REPLACE FUNCTION get_queue_status()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'is_active', COALESCE(qs.is_active, false),
        'allow_online_joining', COALESCE(qs.allow_online_joining, true),
        'max_queue_size', COALESCE(qs.max_queue_size, 20),
        'automatic_mode', COALESCE(qs.automatic_mode, false),
        'current_queue_size', COALESCE(queue_count.total, 0),
        'physical_waiters', COALESCE(queue_count.physical, 0),
        'online_waiters', COALESCE(queue_count.online, 0)
    ) INTO result
    FROM public.queue_settings qs
    CROSS JOIN (
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_physical = true) as physical,
            COUNT(*) FILTER (WHERE is_physical = false) as online
        FROM public.computer_queue 
        WHERE status = 'waiting'
    ) queue_count
    ORDER BY qs.id DESC 
    LIMIT 1;
    
    RETURN result;
END;
$$ language 'plpgsql';

-- 5. Verify the function works
SELECT get_queue_status(); 