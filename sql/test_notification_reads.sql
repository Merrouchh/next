-- Test script to verify notification_reads table and policies work

-- Test 1: Check if table exists and has correct structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'notification_reads' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 2: Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'notification_reads' 
    AND schemaname = 'public';

-- Test 3: Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'notification_reads' 
    AND schemaname = 'public';

-- Test 4: Check if function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'get_notification_read_stats' 
    AND routine_schema = 'public';
