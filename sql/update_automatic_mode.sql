-- Add automatic_mode column to queue_settings table
ALTER TABLE public.queue_settings 
ADD COLUMN IF NOT EXISTS automatic_mode BOOLEAN DEFAULT false;

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_queue_status();

-- Create the get_queue_status function with automatic_mode included
CREATE FUNCTION public.get_queue_status()
RETURNS TABLE (
  id INTEGER,
  is_active BOOLEAN,
  allow_online_joining BOOLEAN,
  max_queue_size INTEGER,
  automatic_mode BOOLEAN,
  current_queue_size BIGINT,
  updated_at TIMESTAMPTZ,
  updated_by UUID
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.is_active,
    s.allow_online_joining,
    s.max_queue_size,
    s.automatic_mode,
    COALESCE(q.queue_count, 0) as current_queue_size,
    s.updated_at,
    s.updated_by
  FROM queue_settings s
  LEFT JOIN (
    SELECT COUNT(*) as queue_count
    FROM computer_queue 
    WHERE status = 'waiting'
  ) q ON true
  WHERE s.id = 1;
END;
$function$;

-- Set default automatic_mode to false for existing settings
UPDATE public.queue_settings 
SET automatic_mode = false 
WHERE automatic_mode IS NULL; 