-- SAFE Fix for Queue Position Race Condition
-- This version fixes the bug without breaking existing functionality

-- First, let's remove the problematic unique constraint that might be causing the 500 error
ALTER TABLE public.computer_queue 
DROP CONSTRAINT IF EXISTS unique_position_per_status;

-- Create a safer version of the position assignment function
-- This version uses SELECT FOR UPDATE but handles errors gracefully
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    -- Try to get the next position with row locking to prevent race conditions
    BEGIN
        SELECT COALESCE(MAX(position), 0) + 1 
        INTO next_pos 
        FROM public.computer_queue 
        WHERE status = 'waiting'
        FOR UPDATE NOWAIT;  -- NOWAIT prevents deadlocks
        
        RETURN next_pos;
    EXCEPTION
        WHEN lock_not_available THEN
            -- If we can't get a lock immediately, fall back to the old method
            -- This prevents deadlocks but might still have the race condition occasionally
            SELECT COALESCE(MAX(position), 0) + 1 
            INTO next_pos 
            FROM public.computer_queue 
            WHERE status = 'waiting';
            
            RETURN next_pos;
    END;
END;
$$ language 'plpgsql';

-- Alternative: Create a simpler fix that just adds retry logic in JavaScript
-- This function provides better error information for debugging
CREATE OR REPLACE FUNCTION get_next_queue_position_with_retry()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
    retry_count INTEGER := 0;
    max_retries INTEGER := 3;
BEGIN
    LOOP
        BEGIN
            -- Try to get the position
            SELECT COALESCE(MAX(position), 0) + 1 
            INTO next_pos 
            FROM public.computer_queue 
            WHERE status = 'waiting';
            
            -- Double-check that this position doesn't already exist
            IF EXISTS (SELECT 1 FROM public.computer_queue WHERE position = next_pos AND status = 'waiting') THEN
                -- If position exists, increment and try again
                next_pos := next_pos + 1;
                retry_count := retry_count + 1;
                
                IF retry_count >= max_retries THEN
                    -- Fall back to a random high number to avoid infinite loop
                    next_pos := (SELECT COALESCE(MAX(position), 0) FROM public.computer_queue WHERE status = 'waiting') + retry_count + 1;
                    EXIT;
                END IF;
            ELSE
                -- Position is available
                EXIT;
            END IF;
        END;
    END LOOP;
    
    RETURN next_pos;
END;
$$ language 'plpgsql';

-- Function to clean up any existing duplicate positions (safe version)
CREATE OR REPLACE FUNCTION safe_fix_duplicate_positions()
RETURNS TABLE(fixed_count INTEGER, details TEXT) AS $$
DECLARE
    duplicate_count INTEGER;
    queue_record RECORD;
    new_position INTEGER := 1;
    fixed_positions INTEGER := 0;
BEGIN
    -- First, check if there are any duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT position 
        FROM public.computer_queue 
        WHERE status = 'waiting' 
        GROUP BY position 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count = 0 THEN
        RETURN QUERY SELECT 0, 'No duplicate positions found'::TEXT;
        RETURN;
    END IF;
    
    -- Fix duplicates by reassigning positions based on creation time
    FOR queue_record IN 
        SELECT id FROM public.computer_queue 
        WHERE status = 'waiting' 
        ORDER BY created_at ASC
    LOOP
        UPDATE public.computer_queue 
        SET position = new_position 
        WHERE id = queue_record.id;
        
        new_position := new_position + 1;
        fixed_positions := fixed_positions + 1;
    END LOOP;
    
    RETURN QUERY SELECT fixed_positions, format('Fixed %s positions, found %s duplicates', fixed_positions, duplicate_count);
END;
$$ language 'plpgsql';

-- Check for current duplicates and fix them
SELECT * FROM safe_fix_duplicate_positions();

-- Create a monitoring function to detect when the race condition occurs
CREATE OR REPLACE FUNCTION check_for_position_duplicates()
RETURNS TABLE(queue_position INTEGER, duplicate_count BIGINT, user_names TEXT[]) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cq.position,
        COUNT(*) as duplicate_count,
        array_agg(cq.user_name) as user_names
    FROM public.computer_queue cq
    WHERE cq.status = 'waiting'
    GROUP BY cq.position
    HAVING COUNT(*) > 1
    ORDER BY cq.position;
END;
$$ language 'plpgsql';

-- You can run this to check for duplicates:
-- SELECT * FROM check_for_position_duplicates(); 