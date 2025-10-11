# Game Time Rewards Security Fix

## Problem Identified

The `game_time_rewards` table had **no Row Level Security (RLS)** enabled, creating a critical security vulnerability:

1. **Exploit Path**: Users could delete their record from the table using the Supabase anon key
2. **Impact**: After deletion, they could call the API again to claim another 1-hour reward
3. **Severity**: HIGH - Users could repeatedly claim unlimited rewards

## Solution Implemented

### 1. Database Security (SQL Migration)

**File**: `sql/fix_game_time_rewards_rls.sql`

**Changes**:
- ✅ Enabled Row Level Security (RLS) on `game_time_rewards` table
- ✅ Created policy allowing users to only SELECT their own records (read-only transparency)
- ✅ Prevented ALL write operations (INSERT/UPDATE/DELETE) for regular users
- ✅ Revoked DELETE, INSERT, UPDATE permissions from authenticated and anon roles
- ✅ Service role (used by API) bypasses RLS and can still perform all operations
- ✅ Added indexes for better query performance:
  - `idx_game_time_rewards_gizmo_id` - Fast lookup by gaming account
  - `idx_game_time_rewards_user_id` - Fast lookup by user
  - `idx_game_time_rewards_created_at` - Fast sorting by date

### 2. API Security Enhancements

**File**: `pages/api/internal/add-game-time-reward.js`

**Improvements**:
- ✅ Enhanced security logging for duplicate claim attempts
- ✅ Added error handling for the reward existence check
- ✅ Improved database insert verification with `.select().single()`
- ✅ Added critical error logging if record insertion fails
- ✅ Added verification that inserted record was actually created
- ✅ Better audit trail for security monitoring

## How to Apply

### Step 1: Run the SQL Migration

Execute the migration on your Supabase database:

```bash
# Option 1: Through Supabase Dashboard
# Navigate to SQL Editor and paste contents of sql/fix_game_time_rewards_rls.sql

# Option 2: Using Supabase CLI
supabase db push
```

### Step 2: Verify Changes

Check that RLS is enabled:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'game_time_rewards';
-- Should show rowsecurity = true
```

Check policies:

```sql
SELECT * FROM pg_policies WHERE tablename = 'game_time_rewards';
-- Should show the "Users can view their own game time rewards" policy
```

### Step 3: Test Security

Try to delete a record as a regular user (should fail):

```javascript
// This should FAIL with permission denied
const { error } = await supabase
  .from('game_time_rewards')
  .delete()
  .eq('user_id', userId);

console.log(error); // Should show permission error
```

## Security Model

### What Users CAN Do:
- ✅ View their own reward history
- ✅ Call the API to claim reward (once per account)

### What Users CANNOT Do:
- ❌ Delete their reward records
- ❌ Insert fake reward records
- ❌ Update existing reward records
- ❌ View other users' rewards

### What the API Can Do (Service Role):
- ✅ Check if reward was already claimed
- ✅ Insert new reward records
- ✅ Update records if needed
- ✅ View all records

## Testing Checklist

- [ ] RLS enabled on `game_time_rewards` table
- [ ] Users can view their own rewards
- [ ] Users cannot delete rewards
- [ ] Users cannot insert fake rewards
- [ ] API can still insert rewards (service role)
- [ ] Duplicate claim attempts are rejected
- [ ] Indexes are created for performance
- [ ] API logs security events properly

## Monitoring

Watch for these log messages:

- `[INTERNAL API] SECURITY: Gizmo ID X already received reward` - Duplicate claim attempt blocked ✅
- `[INTERNAL API] CRITICAL SECURITY ERROR: Failed to record reward` - Manual review needed ⚠️
- `[INTERNAL API] Reward record created successfully` - Normal operation ✅

## Additional Security Recommendations

1. **Monitor logs** for duplicate claim attempts - may indicate malicious activity
2. **Set up alerts** for CRITICAL SECURITY ERROR messages
3. **Periodically audit** the `game_time_rewards` table for anomalies
4. **Consider adding** a rate limit at the API level for extra protection
5. **Review** other tables for similar RLS vulnerabilities

## Related Files

- `sql/fix_game_time_rewards_rls.sql` - SQL migration file
- `pages/api/internal/add-game-time-reward.js` - API endpoint
- `lib/achievements/achievementService.js` - Uses the API
- `utils/api.js` - Client-side wrapper

---

**Date Created**: October 11, 2025  
**Severity**: HIGH  
**Status**: READY TO DEPLOY

