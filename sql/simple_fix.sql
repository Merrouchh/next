-- SIMPLE FIX: Create notification_reads table and policies

-- Step 1: Create the table (this will work even if it exists)
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(notification_id, user_id)
);

-- Step 2: Add foreign key constraints (ignore errors if they exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notification_reads_notification_id_fkey'
    ) THEN
        ALTER TABLE public.notification_reads 
        ADD CONSTRAINT notification_reads_notification_id_fkey 
        FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notification_reads_user_id_fkey'
    ) THEN
        ALTER TABLE public.notification_reads 
        ADD CONSTRAINT notification_reads_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 3: Enable RLS
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies (ignore errors)
DROP POLICY IF EXISTS "notification_reads_select_policy" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads_insert_policy" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads_admin_select_policy" ON public.notification_reads;
DROP POLICY IF EXISTS "Users can view their own notification reads" ON public.notification_reads;
DROP POLICY IF EXISTS "Users can mark notifications as read" ON public.notification_reads;
DROP POLICY IF EXISTS "Admins can view all notification reads" ON public.notification_reads;

-- Step 5: Create simple, working policies
CREATE POLICY "allow_users_to_insert_own_reads" ON public.notification_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_users_to_select_own_reads" ON public.notification_reads
    FOR SELECT USING (auth.uid() = user_id);

-- Step 6: Grant permissions
GRANT ALL ON public.notification_reads TO authenticated;
GRANT USAGE ON SEQUENCE public.notification_reads_id_seq TO authenticated;

-- Step 7: Test the setup
SELECT 'notification_reads table setup complete' as status;
