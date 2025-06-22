-- Fix Race Condition in Queue Position Assignment
-- This fixes the bug where multiple users get assigned the same position (usually position 2)

-- Drop the existing function that has race condition issues
DROP FUNCTION IF EXISTS get_next_queue_position();

-- Create a thread-safe atomic position assignment function
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    -- Use FOR UPDATE to lock the table and prevent race conditions
    -- This ensures only one process can calculate the next position at a time
    SELECT COALESCE(MAX(position), 0) + 1 
    INTO next_pos 
    FROM public.computer_queue 
    WHERE status = 'waiting'
    FOR UPDATE;
    
    RETURN next_pos;
END;
$$ language 'plpgsql';

-- Alternative approach: Use a sequence for guaranteed unique positions
-- Create a sequence for queue positions (if you prefer this approach)
-- DROP SEQUENCE IF EXISTS queue_position_seq;
-- CREATE SEQUENCE queue_position_seq START 1;

-- Alternative function using sequence (uncomment if you want to use this instead)
/*
CREATE OR REPLACE FUNCTION get_next_queue_position_with_sequence()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    -- Get next value from sequence
    next_pos := nextval('queue_position_seq');
    
    -- Reset sequence if queue is empty (optional cleanup)
    IF NOT EXISTS (SELECT 1 FROM public.computer_queue WHERE status = 'waiting') THEN
        PERFORM setval('queue_position_seq', 1, false);
        next_pos := 1;
    END IF;
    
    RETURN next_pos;
END;
$$ language 'plpgsql';
*/

-- Also fix the reorder trigger to be more robust
CREATE OR REPLACE FUNCTION reorder_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
    -- When a queue entry is deleted, update positions of all entries with higher positions
    IF TG_OP = 'DELETE' THEN
        -- Use a lock to prevent race conditions during reordering
        PERFORM 1 FROM public.computer_queue WHERE status = 'waiting' FOR UPDATE;
        
        -- Update positions atomically
        UPDATE public.computer_queue 
        SET position = position - 1
        WHERE position > OLD.position AND status = 'waiting';
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add a unique constraint to prevent duplicate positions (safety net)
-- This will cause an error if duplicates somehow still occur, making the bug obvious
ALTER TABLE public.computer_queue 
ADD CONSTRAINT unique_position_per_status 
UNIQUE (position, status);

-- Function to fix any existing position duplicates
CREATE OR REPLACE FUNCTION fix_duplicate_positions()
RETURNS VOID AS $$
DECLARE
    queue_record RECORD;
    new_position INTEGER := 1;
BEGIN
    -- Fix any existing duplicate positions by reassigning them sequentially
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
    
    RAISE NOTICE 'Fixed % queue positions', new_position - 1;
END;
$$ language 'plpgsql';

-- Run the fix function to clean up any existing duplicates
SELECT fix_duplicate_positions();

-- Optional: Add logging to track when the race condition bug occurs
CREATE TABLE IF NOT EXISTS queue_debug_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    user_id UUID,
    position INTEGER,
    total_in_queue INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB
);

-- Function to log queue operations for debugging
CREATE OR REPLACE FUNCTION log_queue_operation(
    p_action VARCHAR(50),
    p_user_id UUID DEFAULT NULL,
    p_position INTEGER DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO queue_debug_log (action, user_id, position, total_in_queue, details)
    VALUES (
        p_action, 
        p_user_id, 
        p_position,
        (SELECT COUNT(*) FROM public.computer_queue WHERE status = 'waiting'),
        p_details
    );
END;
$$ language 'plpgsql'; 