-- Fix queue_display view to include phone numbers from both sources
-- This addresses the issue where phone numbers were not showing for online users

-- Drop the existing view first to avoid column ordering conflicts
DROP VIEW IF EXISTS public.queue_display;

-- Create the view fresh with all the phone fields included
CREATE VIEW public.queue_display AS
SELECT 
    cq.*,
    u.username as website_username,
    u.email as user_email,
    u.phone as user_phone,  -- Include user's phone from users table
    CASE 
        WHEN cq.is_physical THEN 'Physical'
        ELSE 'Online'
    END as entry_type,
    CASE 
        WHEN cq.position = 1 THEN 'Next in line'
        ELSE 'Position ' || cq.position::text
    END as position_display,
    -- Add a computed field that shows the phone number from either source
    COALESCE(cq.phone_number, u.phone) as display_phone
FROM public.computer_queue cq
LEFT JOIN public.users u ON cq.user_id = u.id
WHERE cq.status = 'waiting'
ORDER BY cq.position;

-- Grant permissions on the updated view
GRANT SELECT ON public.queue_display TO authenticated; 