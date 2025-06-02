-- Add policies for real-time subscriptions to work properly
-- This allows authenticated users to read queue data for real-time updates

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

-- Show current policies to verify
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'computer_queue'; 