-- SIMPLE Fix for Queue Position Race Condition (Run step by step)

-- Step 1: Remove any problematic constraint
ALTER TABLE public.computer_queue 
DROP CONSTRAINT IF EXISTS unique_position_per_status;

-- Step 2: Fix the position assignment function (safer version)
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    -- Simple fix: Just get max position and add 1
    SELECT COALESCE(MAX(position), 0) + 1 
    INTO next_pos 
    FROM public.computer_queue 
    WHERE status = 'waiting';
    
    RETURN next_pos;
END;
$$ language 'plpgsql';

-- Step 3: Function to fix any existing duplicate positions
CREATE OR REPLACE FUNCTION fix_queue_positions()
RETURNS VOID AS $$
DECLARE
    queue_record RECORD;
    new_position INTEGER := 1;
BEGIN
    -- Reassign all positions sequentially based on creation time
    FOR queue_record IN 
        SELECT id FROM public.computer_queue 
        WHERE status = 'waiting' 
        ORDER BY created_at ASC
    LOOP
        UPDATE public.computer_queue 
        SET position = new_position 
        WHERE id = queue_record.id;
        
        new_position := new_position + 1;
    END LOOP;
END;
$$ language 'plpgsql';

-- Step 4: Run the fix
SELECT fix_queue_positions();

-- Step 5: Check for any remaining duplicates (optional)
SELECT 
    position as queue_position,
    COUNT(*) as duplicate_count,
    string_agg(user_name, ', ') as users
FROM public.computer_queue 
WHERE status = 'waiting'
GROUP BY position
HAVING COUNT(*) > 1
ORDER BY position; 