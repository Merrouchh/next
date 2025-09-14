-- Create notification_reads table to track which users have seen notifications
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

-- Policy for users to read their own read status
CREATE POLICY "Users can view their own notification reads" ON public.notification_reads
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own read status
CREATE POLICY "Users can mark notifications as read" ON public.notification_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for admins to view all read statuses
CREATE POLICY "Admins can view all notification reads" ON public.notification_reads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notification_reads_notification_id ON public.notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_read_at ON public.notification_reads(read_at);

-- Add a function to get notification read statistics
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
