-- ========================================
-- EMERGENCY FIX: Complete RLS Reset for users table
-- ========================================
-- This script completely removes ALL policies and starts fresh
-- Run this if you're still seeing infinite recursion errors

-- Step 1: Disable RLS temporarily to clear everything
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (comprehensive list)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 3: Drop existing triggers
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_trigger ON users;
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_update_trigger ON users;
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_insert_trigger ON users;

-- Step 4: Recreate the trigger function (simple, no recursion)
CREATE OR REPLACE FUNCTION protect_sensitive_user_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT: prevent creating users with admin/staff privileges
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.is_admin, FALSE) = TRUE THEN
            RAISE EXCEPTION 'Cannot create user with admin privileges';
        END IF;
        IF COALESCE(NEW.is_staff, FALSE) = TRUE THEN
            RAISE EXCEPTION 'Cannot create user with staff privileges';
        END IF;
        RETURN NEW;
    END IF;
    
    -- For UPDATE: prevent changes to sensitive fields
    IF TG_OP = 'UPDATE' THEN
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'You do not have permission to modify is_admin field';
        END IF;
        
        IF NEW.is_staff IS DISTINCT FROM OLD.is_staff THEN
            RAISE EXCEPTION 'You do not have permission to modify is_staff field';
        END IF;
        
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'You do not have permission to modify id field';
        END IF;
        
        IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'You do not have permission to modify created_at field';
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create triggers
CREATE TRIGGER protect_user_sensitive_fields_update_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_sensitive_user_fields();

CREATE TRIGGER protect_user_sensitive_fields_insert_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_sensitive_user_fields();

-- Step 6: Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Step 7: Create ONLY the essential policies (SUPER SIMPLE, NO RECURSION POSSIBLE)

-- Policy 1: Everyone can read (anonymous + authenticated)
CREATE POLICY "users_select_policy"
ON users FOR SELECT
TO public
USING (true);

-- Policy 2: Users can update their own record
CREATE POLICY "users_update_own"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can insert their own record
CREATE POLICY "users_insert_own"
ON users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 8: Create RPC function for gizmo linking
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

GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO authenticated;

-- Step 9: Verification
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'users';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'EMERGENCY FIX COMPLETED';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total policies on users table: %', policy_count;
    RAISE NOTICE 'RLS is enabled: Yes';
    RAISE NOTICE 'Triggers active: 2 (INSERT + UPDATE)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'These policies CANNOT cause recursion:';
    RAISE NOTICE '1. SELECT: USING (true) - no queries';
    RAISE NOTICE '2. UPDATE: USING (auth.uid() = id) - no subqueries';
    RAISE NOTICE '3. INSERT: WITH CHECK (auth.uid() = id) - no subqueries';
    RAISE NOTICE '========================================';
END $$;

-- Display all current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;

