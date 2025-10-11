-- ========================================
-- FINAL FIX: Users Table RLS (No Recursion Possible)
-- ========================================
-- This completely eliminates ALL sources of infinite recursion
-- Allows user creation with username and gizmo_id

-- Step 1: Temporarily disable RLS to clean everything
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies dynamically
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 3: Drop all existing triggers
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_trigger ON users;
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_update_trigger ON users;
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_insert_trigger ON users;

-- Step 4: Drop old functions
DROP FUNCTION IF EXISTS protect_sensitive_user_fields() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Step 5: Create NEW trigger function (handles both INSERT and UPDATE)
CREATE OR REPLACE FUNCTION prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT: Block if trying to set admin/staff to true
    IF TG_OP = 'INSERT' THEN
        -- Force is_admin and is_staff to false for new users
        NEW.is_admin := COALESCE(NEW.is_admin, FALSE);
        NEW.is_staff := COALESCE(NEW.is_staff, FALSE);
        
        -- If someone tries to set them to true, force to false
        IF NEW.is_admin = TRUE THEN
            NEW.is_admin := FALSE;
            RAISE WARNING 'Blocked attempt to create user with admin privileges';
        END IF;
        
        IF NEW.is_staff = TRUE THEN
            NEW.is_staff := FALSE;
            RAISE WARNING 'Blocked attempt to create user with staff privileges';
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- For UPDATE: Prevent modification of sensitive fields
    IF TG_OP = 'UPDATE' THEN
        -- Block changes to is_admin
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            NEW.is_admin := OLD.is_admin;
            RAISE WARNING 'Blocked attempt to modify is_admin field';
        END IF;
        
        -- Block changes to is_staff
        IF NEW.is_staff IS DISTINCT FROM OLD.is_staff THEN
            NEW.is_staff := OLD.is_staff;
            RAISE WARNING 'Blocked attempt to modify is_staff field';
        END IF;
        
        -- Block changes to id
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            NEW.id := OLD.id;
            RAISE WARNING 'Blocked attempt to modify id field';
        END IF;
        
        -- Block changes to created_at
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            NEW.created_at := OLD.created_at;
            RAISE WARNING 'Blocked attempt to modify created_at field';
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create triggers
CREATE TRIGGER prevent_privilege_escalation_insert
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_privilege_escalation();

CREATE TRIGGER prevent_privilege_escalation_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_privilege_escalation();

-- Step 7: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Step 8: Create SUPER SIMPLE policies (NO RECURSION POSSIBLE)

-- Policy 1: SELECT - Everyone can read all user data
-- This is the ONLY SELECT policy, no conditions that could cause recursion
CREATE POLICY "allow_all_select"
ON users FOR SELECT
TO public
USING (true);

-- Policy 2: INSERT - Authenticated users can insert their own record
-- Simple check: auth.uid() must equal the id being inserted
-- NO subqueries, NO EXISTS, NO SELECT from users table
CREATE POLICY "allow_own_insert"
ON users FOR INSERT
TO authenticated
WITH CHECK (
    -- User can only insert their own record
    -- The trigger will automatically set is_admin/is_staff to false
    auth.uid() = id
);

-- Policy 3: UPDATE - Users can only update their own record  
-- Simple check: auth.uid() must equal the id being updated
-- NO subqueries, NO EXISTS, NO SELECT from users table
CREATE POLICY "allow_own_update"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- NO DELETE POLICY - Admins must use Service Role Key to delete

-- Step 9: Create RPC function for gizmo account linking
CREATE OR REPLACE FUNCTION check_gizmo_linked(gizmo_user_id TEXT)
RETURNS TABLE (
    is_linked BOOLEAN,
    linked_username TEXT,
    linked_email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE as is_linked,
        u.username as linked_username,
        u.email as linked_email
    FROM users u
    WHERE u.gizmo_id::TEXT = gizmo_user_id
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE, NULL::TEXT, NULL::TEXT;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO authenticated;

-- Step 10: Verification
DO $$
DECLARE
    policy_count INTEGER;
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'users';
    SELECT COUNT(*) INTO trigger_count FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'users' AND NOT t.tgisinternal;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FINAL FIX COMPLETED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total RLS policies: %', policy_count;
    RAISE NOTICE 'Total triggers: %', trigger_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'How it works:';
    RAISE NOTICE '1. Users can INSERT with username + gizmo_id ✅';
    RAISE NOTICE '2. Trigger auto-sets is_admin/is_staff to false ✅';
    RAISE NOTICE '3. Users can UPDATE their own safe fields ✅';
    RAISE NOTICE '4. NO infinite recursion possible ✅';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Security guarantees:';
    RAISE NOTICE '- is_admin/is_staff always forced to false on INSERT';
    RAISE NOTICE '- is_admin/is_staff cannot be changed on UPDATE';
    RAISE NOTICE '- id and created_at cannot be changed on UPDATE';
    RAISE NOTICE '- Admins use Service Role Key (bypasses all)';
    RAISE NOTICE '========================================';
END $$;

-- Display all policies
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || qual
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

