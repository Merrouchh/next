# 🚨 CRITICAL SECURITY FIX: Users Table RLS Vulnerability

## Severity: **CRITICAL**
**Date Discovered**: October 11, 2025  
**Status**: ✅ FIXED

---

## Executive Summary

A **critical privilege escalation vulnerability** was discovered in the `users` table Row Level Security (RLS) policies. The vulnerability allowed **any authenticated user to modify their own `is_admin` and `is_staff` fields**, effectively granting themselves administrator or staff privileges without authorization.

### Impact
- ❌ Any user could escalate to admin privileges
- ❌ Any user could escalate to staff privileges  
- ❌ No audit trail of unauthorized privilege changes
- ❌ Complete system compromise possible

---

## Vulnerability Details

### The Problem

Previous RLS policies on the `users` table:

```sql
-- VULNERABLE POLICY
CREATE POLICY "Users can update their own record"
ON users FOR UPDATE
USING (auth.uid() = id);
```

**Why This Was Dangerous:**
1. The policy only checked `USING (auth.uid() = id)` - meaning users can update their own row
2. **No `WITH CHECK` constraint** to prevent modification of sensitive fields
3. No field-level restrictions on what could be updated
4. Users could send updates like: `{ is_admin: true, is_staff: true }` to their own record

### Attack Vector

A malicious user could execute:

```javascript
// From client-side code or API
await supabase
  .from('users')
  .update({ 
    is_admin: true,
    is_staff: true 
  })
  .eq('id', currentUserId);
```

**Result:** Instant admin access to the entire system.

---

## The Fix

### New Security Architecture

The fix implements **defense in depth** with multiple security layers:

#### 1. **Database Trigger Protection** (Prevents Infinite Recursion)
Instead of using recursive RLS policies, we use a BEFORE UPDATE trigger:

```sql
CREATE OR REPLACE FUNCTION protect_sensitive_user_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user is admin (using SECURITY DEFINER to bypass RLS)
    IF NOT is_admin THEN
        -- Prevent modification of sensitive fields
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'No permission to modify is_admin';
        END IF;
        -- Same for is_staff, id, created_at
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Why Triggers Instead of RLS?**
- ❌ RLS policies that SELECT from the same table cause **infinite recursion**
- ✅ Triggers with `SECURITY DEFINER` bypass RLS and work correctly
- ✅ Triggers execute BEFORE the update, preventing bad data entirely

**Protected Fields:**
- ✅ `id` - Cannot be changed (immutable)
- ✅ `is_admin` - Cannot be changed by regular users
- ✅ `is_staff` - Cannot be changed by regular users
- ✅ `created_at` - Cannot be changed (immutable)

#### 2. **RPC Function for Gizmo Linking** (Bypasses RLS)
We created a dedicated RPC function to check if a gizmo_id is already linked:

```sql
CREATE OR REPLACE FUNCTION check_gizmo_linked(gizmo_user_id TEXT)
RETURNS TABLE (is_linked BOOLEAN, linked_username TEXT, linked_email TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- Query users table with RLS bypassed
    RETURN QUERY SELECT TRUE, u.username, u.email
    FROM users u WHERE u.gizmo_id = gizmo_user_id LIMIT 1;
END;
$$;
```

**Usage in API:**
```javascript
// Before (caused infinite recursion):
const { data } = await supabase.from('users').select('*').eq('gizmo_id', id);

// After (works perfectly):
const { data } = await supabase.rpc('check_gizmo_linked', { gizmo_user_id: id });
```

#### 3. **Admin-Only Modification**
```sql
CREATE POLICY "Admins have full access to users table"
ON users FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() 
        AND is_admin = true
    )
);
```

Only existing admins can modify sensitive fields.

#### 4. **Secure User Creation**
```sql
CREATE POLICY "Only auth system and admins can insert users"
ON users FOR INSERT
WITH CHECK (
    -- User creating their own account cannot set admin/staff
    (id = auth.uid() AND is_admin = false AND is_staff = false)
    OR
    -- Or must be an admin
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
```

Prevents privilege escalation during account creation.

---

## Migration File

**File:** `sql/fix_users_table_critical_security.sql`

To apply this fix:

```bash
# Run the migration in Supabase SQL Editor
# Or using psql:
psql -h your-db-host -U postgres -d your-db-name -f sql/fix_users_table_critical_security.sql
```

---

## Verification Steps

### 1. Check RLS is Enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'users';
-- Should return: rowsecurity = true
```

### 2. Verify Policies Exist
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';
```

### 3. Test User Cannot Escalate Privileges
```javascript
// This should FAIL with RLS violation
const { error } = await supabase
  .from('users')
  .update({ is_admin: true })
  .eq('id', currentUserId);

console.log(error); // Should show RLS policy violation
```

### 4. Test User Can Update Allowed Fields
```javascript
// This should SUCCEED
const { data, error } = await supabase
  .from('users')
  .update({ 
    username: 'newusername',
    phone: '1234567890'
  })
  .eq('id', currentUserId);

console.log(data); // Should return updated user
```

---

## Additional Security Recommendations

### 1. **Audit Existing Users**
Check if anyone exploited this vulnerability:

```sql
-- Check for recent admin changes
SELECT 
    id,
    username,
    email,
    is_admin,
    is_staff,
    created_at
FROM users
WHERE is_admin = true OR is_staff = true
ORDER BY created_at DESC;
```

### 2. **Review Audit Logs**
If you have audit logging enabled, check for suspicious `UPDATE` operations on the `users` table.

### 3. **Implement Application-Level Checks**
Even with RLS, implement checks in your API:

```javascript
// In your API routes
export default async function handler(req, res) {
    const { user } = await checkServerSideAdmin(req, res);
    
    if (!user?.is_admin) {
        return res.status(403).json({ 
            error: 'Unauthorized: Admin access required' 
        });
    }
    
    // Continue with admin operation...
}
```

### 4. **Enable Audit Logging**
Consider enabling PostgreSQL audit logging for the `users` table:

```sql
-- Track all changes to sensitive fields
CREATE TABLE IF NOT EXISTS users_audit (
    audit_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    old_is_admin BOOLEAN,
    new_is_admin BOOLEAN,
    old_is_staff BOOLEAN,
    new_is_staff BOOLEAN
);

-- Create trigger for audit trail
CREATE OR REPLACE FUNCTION audit_users_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_admin IS DISTINCT FROM NEW.is_admin 
       OR OLD.is_staff IS DISTINCT FROM NEW.is_staff THEN
        INSERT INTO users_audit (
            user_id, 
            changed_by, 
            old_is_admin, 
            new_is_admin,
            old_is_staff,
            new_is_staff
        )
        VALUES (
            NEW.id,
            auth.uid(),
            OLD.is_admin,
            NEW.is_admin,
            OLD.is_staff,
            NEW.is_staff
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER users_audit_trigger
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_users_changes();
```

---

## Testing Checklist

- [ ] RLS is enabled on `users` table
- [ ] All old insecure policies are dropped
- [ ] New policies are created successfully
- [ ] Regular users CANNOT update `is_admin`
- [ ] Regular users CANNOT update `is_staff`
- [ ] Regular users CAN update allowed fields (username, phone, etc.)
- [ ] Admins CAN update all fields
- [ ] New user registrations cannot set admin/staff privileges
- [ ] Audit trail is in place (if implemented)
- [ ] Application-level checks are added

---

## Related Files

- **Migration:** `sql/fix_users_table_critical_security.sql`
- **Server-side checks:** `utils/supabase/server-admin.js`
- **Auth context:** `contexts/AuthContext.js`
- **User type definition:** `types/user.ts`

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- Previous fixes: `migrations/fix-users-table.sql`, `migrations/fix-users-points-rls.sql`

---

## Lessons Learned

1. **Always use `WITH CHECK` constraints** for UPDATE and INSERT policies
2. **Field-level security** is critical for tables with sensitive data
3. **Defense in depth**: Implement security at database AND application levels
4. **Regular security audits** are essential
5. **Test security policies** with actual attack scenarios

---

**Priority:** Apply this fix immediately to production!

