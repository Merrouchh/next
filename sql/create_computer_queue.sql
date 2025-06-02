-- Create table for managing the computer waiting queue
CREATE TABLE IF NOT EXISTS public.computer_queue (
  id SERIAL PRIMARY KEY,
  user_name TEXT NOT NULL,
  phone_number TEXT,
  notes TEXT,
  computer_type TEXT NOT NULL CHECK (computer_type IN ('normal', 'vip', 'any')),
  position INTEGER NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- User who joined the queue (for logged-in users)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL -- Admin who added them
);

-- Add the user_id column if it doesn't exist (for existing installations)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='computer_queue' AND column_name='user_id') THEN
    ALTER TABLE public.computer_queue ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster position-based queries
CREATE INDEX IF NOT EXISTS idx_computer_queue_position ON public.computer_queue(position);
CREATE INDEX IF NOT EXISTS idx_computer_queue_type_position ON public.computer_queue(computer_type, position);

-- Add Row Level Security
ALTER TABLE public.computer_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can manage the queue
CREATE POLICY "Only admins can manage computer queue"
ON public.computer_queue
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.is_admin = true
  )
);

-- Policy: Allow authenticated users to read queue data for real-time subscriptions
DROP POLICY IF EXISTS "Authenticated users can read queue" ON public.computer_queue;
CREATE POLICY "Authenticated users can read queue"
ON public.computer_queue
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow users to read their own queue entries for real-time updates
DROP POLICY IF EXISTS "Users can read their own queue entries" ON public.computer_queue;
CREATE POLICY "Users can read their own queue entries"
ON public.computer_queue
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Function to reorder positions when someone is removed
CREATE OR REPLACE FUNCTION reorder_queue_positions() 
RETURNS TRIGGER AS $$
BEGIN
  -- When someone is deleted from the queue, reorder the remaining positions
  IF TG_OP = 'DELETE' THEN
    UPDATE public.computer_queue 
    SET position = position - 1,
        updated_at = NOW()
    WHERE position > OLD.position;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically reorder positions
CREATE TRIGGER trigger_reorder_queue_positions
AFTER DELETE ON public.computer_queue
FOR EACH ROW EXECUTE FUNCTION reorder_queue_positions();

-- Function to get next position in queue
CREATE OR REPLACE FUNCTION get_next_queue_position() 
RETURNS INTEGER AS $$
DECLARE
  next_pos INTEGER;
BEGIN
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_pos FROM public.computer_queue;
  RETURN next_pos;
END;
$$ LANGUAGE plpgsql;

-- Insert some example data for testing (remove this in production)
-- INSERT INTO public.computer_queue (user_name, phone_number, computer_type, position, notes) VALUES
-- ('Ahmed Mohamed', '+212612345678', 'normal', 1, 'Wants to play FIFA'),
-- ('Youssef Ali', '+212698765432', 'vip', 2, 'Tournament player'); 