-- Physical Queue Management System for Merrouch Gaming Center
-- This system manages people physically waiting in the shop

-- Table for storing the main computer queue (physical waiters + online joiners)
CREATE TABLE IF NOT EXISTS public.computer_queue (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(255) NOT NULL, -- Username from website account
  phone_number VARCHAR(20), -- Optional phone number
  notes TEXT, -- Admin notes about the person
  computer_type VARCHAR(50) NOT NULL CHECK (computer_type IN ('any', 'top', 'bottom')), -- Preference
  position INTEGER NOT NULL, -- Position in queue
  is_physical BOOLEAN DEFAULT false, -- True if person is physically present in shop
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'playing', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id), -- Admin who added them (for physical entries)
  user_id UUID REFERENCES auth.users(id) -- Linked website account (if exists)
);

-- Table for queue system settings
CREATE TABLE IF NOT EXISTS public.queue_settings (
  id SERIAL PRIMARY KEY,
  is_active BOOLEAN DEFAULT false, -- Whether queue system is currently active
  allow_online_joining BOOLEAN DEFAULT true, -- Whether online users can join queue
  max_queue_size INTEGER DEFAULT 20, -- Maximum number of people in queue
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) -- Admin who last updated settings
);

-- Insert default settings
INSERT INTO public.queue_settings (is_active, allow_online_joining, max_queue_size)
VALUES (false, true, 20)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_computer_queue_position ON public.computer_queue(position);
CREATE INDEX IF NOT EXISTS idx_computer_queue_status ON public.computer_queue(status);
CREATE INDEX IF NOT EXISTS idx_computer_queue_user_id ON public.computer_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_computer_queue_is_physical ON public.computer_queue(is_physical);
CREATE INDEX IF NOT EXISTS idx_computer_queue_created_at ON public.computer_queue(created_at);

-- Create function to update updated_at automatically
CREATE OR REPLACE FUNCTION update_computer_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_computer_queue_updated_at ON public.computer_queue;
CREATE TRIGGER update_computer_queue_updated_at
    BEFORE UPDATE ON public.computer_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_computer_queue_updated_at();

-- Create trigger for queue_settings
DROP TRIGGER IF EXISTS update_queue_settings_updated_at ON public.queue_settings;
CREATE TRIGGER update_queue_settings_updated_at
    BEFORE UPDATE ON public.queue_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE public.computer_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for computer_queue
-- Allow everyone to read the queue (for displaying queue status)
DROP POLICY IF EXISTS computer_queue_read_policy ON public.computer_queue;
CREATE POLICY computer_queue_read_policy ON public.computer_queue
    FOR SELECT USING (true);

-- Allow users to insert their own queue entries (online joining)
DROP POLICY IF EXISTS computer_queue_user_insert_policy ON public.computer_queue;
CREATE POLICY computer_queue_user_insert_policy ON public.computer_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own queue entries
DROP POLICY IF EXISTS computer_queue_user_update_policy ON public.computer_queue;
CREATE POLICY computer_queue_user_update_policy ON public.computer_queue
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own queue entries
DROP POLICY IF EXISTS computer_queue_user_delete_policy ON public.computer_queue;
CREATE POLICY computer_queue_user_delete_policy ON public.computer_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Allow admins full access to computer_queue
DROP POLICY IF EXISTS computer_queue_admin_policy ON public.computer_queue;
CREATE POLICY computer_queue_admin_policy ON public.computer_queue
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- Allow service role full access
DROP POLICY IF EXISTS computer_queue_service_policy ON public.computer_queue;
CREATE POLICY computer_queue_service_policy ON public.computer_queue
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for queue_settings
-- Allow everyone to read queue settings
DROP POLICY IF EXISTS queue_settings_read_policy ON public.queue_settings;
CREATE POLICY queue_settings_read_policy ON public.queue_settings
    FOR SELECT USING (true);

-- Only admins can modify queue settings
DROP POLICY IF EXISTS queue_settings_admin_policy ON public.queue_settings;
CREATE POLICY queue_settings_admin_policy ON public.queue_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.is_admin = true
        )
    );

-- Allow service role full access
DROP POLICY IF EXISTS queue_settings_service_policy ON public.queue_settings;
CREATE POLICY queue_settings_service_policy ON public.queue_settings
    FOR ALL USING (auth.role() = 'service_role');

-- Function to reorder queue positions when someone leaves
CREATE OR REPLACE FUNCTION reorder_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
    -- When a queue entry is deleted, update positions of all entries with higher positions
    IF TG_OP = 'DELETE' THEN
        UPDATE public.computer_queue 
        SET position = position - 1
        WHERE position > OLD.position AND status = 'waiting';
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger to automatically reorder positions when someone leaves the queue
DROP TRIGGER IF EXISTS reorder_queue_on_delete ON public.computer_queue;
CREATE TRIGGER reorder_queue_on_delete
    AFTER DELETE ON public.computer_queue
    FOR EACH ROW
    EXECUTE FUNCTION reorder_queue_positions();

-- Function to get next available position in queue
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    SELECT COALESCE(MAX(position), 0) + 1 
    INTO next_pos 
    FROM public.computer_queue 
    WHERE status = 'waiting';
    
    RETURN next_pos;
END;
$$ language 'plpgsql';

-- Function to check if queue is active
CREATE OR REPLACE FUNCTION is_queue_active()
RETURNS BOOLEAN AS $$
DECLARE
    queue_active BOOLEAN;
BEGIN
    SELECT is_active INTO queue_active 
    FROM public.queue_settings 
    ORDER BY id DESC LIMIT 1;
    
    RETURN COALESCE(queue_active, false);
END;
$$ language 'plpgsql';

-- Function to get current queue status
CREATE OR REPLACE FUNCTION get_queue_status()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'is_active', COALESCE(qs.is_active, false),
        'allow_online_joining', COALESCE(qs.allow_online_joining, true),
        'max_queue_size', COALESCE(qs.max_queue_size, 20),
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

-- Create view for easier queue management
CREATE OR REPLACE VIEW queue_display AS
SELECT 
    cq.*,
    u.username as website_username,
    u.email as user_email,
    CASE 
        WHEN cq.is_physical THEN 'Physical'
        ELSE 'Online'
    END as entry_type,
    CASE 
        WHEN cq.position = 1 THEN 'Next in line'
        ELSE 'Position ' || cq.position::text
    END as position_display
FROM public.computer_queue cq
LEFT JOIN public.users u ON cq.user_id = u.id
WHERE cq.status = 'waiting'
ORDER BY cq.position; 