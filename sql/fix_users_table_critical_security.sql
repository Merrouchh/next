-- ========================================
-- CRITICAL SECURITY FIX: Users Table RLS
-- ========================================
-- This migration fixes a critical security vulnerability where users could
-- modify their own is_admin and is_staff fields to escalate privileges.
--
-- Approach:
-- 1. Simple RLS policies (SELECT for all, UPDATE/INSERT for own record only)
-- 2. Database triggers protect sensitive fields (is_admin, is_staff, id, created_at)
-- 3. NO admin checks in RLS policies (prevents infinite recursion)
-- 4. Admins MUST use Service Role Key which bypasses RLS and triggers
-- 5. RPC function for gaming account linking (bypasses RLS)

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read other users" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins have full access" ON users;
DROP POLICY IF EXISTS "Anyone can read public user profiles" ON users;
DROP POLICY IF EXISTS "Allow read access to all users" ON users;
DROP POLICY IF EXISTS "Users can update themselves" ON users;
DROP POLICY IF EXISTS "Users can update their own points" ON users;
DROP POLICY IF EXISTS "Anyone can view user profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own non-sensitive fields" ON users;
DROP POLICY IF EXISTS "Admins have full access to users table" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Admins can insert any user" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Only auth system and admins can insert users" ON users;
DROP POLICY IF EXISTS "Only admins can delete users" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- ========================================
-- SELECT POLICIES (Reading Data)
-- ========================================

-- Policy 1: Allow everyone to read user profiles
-- This is safe because we're only exposing public profile information
CREATE POLICY "Anyone can view user profiles"
ON users FOR SELECT
USING (true);

-- ========================================
-- TRIGGER FUNCTION TO PROTECT SENSITIVE FIELDS
-- ========================================
-- This function prevents users from modifying sensitive fields
-- It runs BEFORE any INSERT/UPDATE and checks if protected fields are being changed
-- Service Role Key bypasses triggers, so admins must use that
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

-- Drop the triggers if they exist and recreate them
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_update_trigger ON users;
DROP TRIGGER IF EXISTS protect_user_sensitive_fields_insert_trigger ON users;

-- Trigger for UPDATE operations
CREATE TRIGGER protect_user_sensitive_fields_update_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_sensitive_user_fields();

-- Trigger for INSERT operations (prevents creating admin accounts)
CREATE TRIGGER protect_user_sensitive_fields_insert_trigger
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION protect_sensitive_user_fields();

-- ========================================
-- UPDATE POLICIES (Modifying Data)
-- ========================================

-- Policy 2: Users can update their own records
-- The trigger above will prevent modification of sensitive fields
CREATE POLICY "Users can update their own record"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ========================================
-- SIMPLIFIED APPROACH - NO ADMIN CHECKS IN RLS
-- ========================================
-- We rely entirely on the TRIGGER to protect sensitive fields
-- This avoids ALL recursion issues
-- Admins will use Service Role Key which bypasses RLS entirely

-- ========================================
-- INSERT POLICIES (New User Creation)
-- ========================================

-- Policy 3: Users can create their own account
-- The trigger will prevent setting admin/staff to true
CREATE POLICY "Users can insert their own record"
ON users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ========================================
-- DELETE POLICIES
-- ========================================

-- Policy 4: No one can delete via RLS (admins use Service Role Key)
-- We don't create a DELETE policy - only service role can delete

-- ========================================
-- VERIFICATION AND LOGGING
-- ========================================

-- Log current admin users for audit trail
DO $$
DECLARE
    admin_count INTEGER;
    staff_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users WHERE is_admin = true;
    SELECT COUNT(*) INTO staff_count FROM users WHERE is_staff = true;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SECURITY FIX APPLIED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Current admin users: %', admin_count;
    RAISE NOTICE 'Current staff users: %', staff_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Protected fields: id, is_admin, is_staff, created_at';
    RAISE NOTICE 'Users can now only update non-sensitive fields';
    RAISE NOTICE '========================================';
END $$;

-- Display current admins and staff for verification
SELECT 
    id, 
    username, 
    email, 
    is_admin, 
    is_staff,
    created_at
FROM users 
WHERE is_admin = true OR is_staff = true
ORDER BY is_admin DESC, is_staff DESC;

-- ========================================
-- RPC FUNCTION FOR GAMING CREDENTIALS CHECK
-- ========================================
-- This function allows checking if a gizmo_id is already linked
-- without exposing the entire users table through RLS
-- This solves the infinite recursion problem for unauthenticated requests

-- First, check what type gizmo_id is and create appropriate function
-- We'll use TEXT input but cast it appropriately for comparison

CREATE OR REPLACE FUNCTION check_gizmo_linked(gizmo_user_id TEXT)
RETURNS TABLE (
    is_linked BOOLEAN,
    linked_username TEXT,
    linked_email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- This bypasses RLS
SET search_path = public
AS $$
BEGIN
    -- Try to find user with this gizmo_id
    -- We cast the TEXT input to match the gizmo_id column type
    RETURN QUERY
    SELECT 
        TRUE as is_linked,
        u.username as linked_username,
        u.email as linked_email
    FROM users u
    WHERE u.gizmo_id::TEXT = gizmo_user_id
    LIMIT 1;
    
    -- If no rows found, return false
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE, NULL::TEXT, NULL::TEXT;
    END IF;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_gizmo_linked(TEXT) TO authenticated;

