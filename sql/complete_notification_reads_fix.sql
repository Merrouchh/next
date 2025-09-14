-- Complete fix for notification_reads table and RLS policies

-- First, check if the table exists and create it if it doesn't
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users can mark notifications as read" ON public.notification_reads;
DROP POLICY IF EXISTS "Admins can view all notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.notification_reads;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.notification_reads;

-- Create new policies with correct syntax
CREATE POLICY "notification_reads_select_policy" ON public.notification_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_reads_insert_policy" ON public.notification_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_reads_admin_select_policy" ON public.notification_reads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON public.notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_read_at ON public.notification_reads(read_at);

-- Create or replace the function for read statistics
CREATE OR REPLACE FUNCTION get_notification_read_stats(notification_id_param BIGINT)
RETURNS TABLE (
    total_users BIGINT,
    read_users BIGINT,
    read_percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.users WHERE is_admin = false OR is_admin IS NULL)::BIGINT as total_users,
        (SELECT COUNT(*) FROM public.notification_reads WHERE notification_id = notification_id_param)::BIGINT as read_users,
        CASE 
            WHEN (SELECT COUNT(*) FROM public.users WHERE is_admin = false OR is_admin IS NULL) > 0 
            THEN ROUND(
                (SELECT COUNT(*) FROM public.notification_reads WHERE notification_id = notification_id_param)::NUMERIC * 100.0 / 
                (SELECT COUNT(*) FROM public.users WHERE is_admin = false OR is_admin IS NULL)::NUMERIC, 
                2
            )
            ELSE 0
        END as read_percentage;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_notification_read_stats(BIGINT) TO authenticated;

-- Grant necessary permissions on the table
GRANT SELECT, INSERT ON public.notification_reads TO authenticated;
GRANT USAGE ON SEQUENCE public.notification_reads_id_seq TO authenticated;
