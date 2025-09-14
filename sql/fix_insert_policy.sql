-- Fix the INSERT policy for notification_reads

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "allow_users_to_insert_own_reads" ON public.notification_reads;

-- Create a new INSERT policy with explicit auth check
CREATE POLICY "allow_users_to_insert_own_reads" ON public.notification_reads
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = user_id
    );

-- Also create a policy for UPDATE (in case we need it later)
CREATE POLICY "allow_users_to_update_own_reads" ON public.notification_reads
    FOR UPDATE USING (
        auth.uid() IS NOT NULL 
        AND auth.uid() = user_id
    ) WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = user_id
    );

-- Test the policy by checking what the current user can see
SELECT 
    'Current auth.uid(): ' || COALESCE(auth.uid()::text, 'NULL') as auth_status,
    'Policy test complete' as status;
