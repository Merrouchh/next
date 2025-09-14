-- Fix notification_reads table structure and policies

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users can mark notifications as read" ON public.notification_reads;
DROP POLICY IF EXISTS "Admins can view all notification reads" ON public.notification_reads;

-- Recreate policies with correct structure
CREATE POLICY "Users can view their own notification reads" ON public.notification_reads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mark notifications as read" ON public.notification_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification reads" ON public.notification_reads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Create the function if it doesn't exist
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
