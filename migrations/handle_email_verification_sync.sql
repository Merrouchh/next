-- Function to handle email confirmation sync between auth.users and public.email_verifications
CREATE OR REPLACE FUNCTION sync_email_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger fires when an email is updated in auth.users
  -- We need to check if this is a confirmation of an email change
  
  -- If an email was changed (new email != old email)
  IF NEW.email IS NOT NULL AND OLD.email IS NOT NULL AND NEW.email != OLD.email THEN
    -- Find any pending verification for this user where new_email matches the confirmed email
    UPDATE public.email_verifications
    SET 
      status = 'verified',
      verified_at = NOW()
    WHERE 
      user_id = NEW.id
      AND status = 'pending'
      AND new_email = NEW.email;
      
    -- Log the sync operation
    RAISE NOTICE 'Email verification synced for user %, email %', NEW.id, NEW.email;
  END IF;
  
  -- When email_change and email_change_token_new are cleared but not due to an email change
  -- (likely a cancellation on Supabase side)
  IF OLD.email_change IS NOT NULL AND OLD.email_change != '' 
     AND (NEW.email_change IS NULL OR NEW.email_change = '')
     AND OLD.email = NEW.email THEN
    
    -- This indicates a cancellation, mark all pending verifications as cancelled
    UPDATE public.email_verifications
    SET 
      status = 'cancelled',
      cancelled_at = NOW()
    WHERE 
      user_id = NEW.id
      AND status = 'pending'
      AND new_email = OLD.email_change;
      
    -- Log the cancellation sync
    RAISE NOTICE 'Email verification cancelled for user %, email %', NEW.id, OLD.email_change;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists (to avoid conflicts when recreating)
DROP TRIGGER IF EXISTS sync_email_verification_on_update ON auth.users;

-- Create the trigger on auth.users
CREATE TRIGGER sync_email_verification_on_update
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_email_verification_status();

-- Additional function to periodically scan for verified emails
CREATE OR REPLACE FUNCTION scan_for_verified_emails()
RETURNS void AS $$
DECLARE
  verification RECORD;
  auth_user RECORD;
BEGIN
  -- Get all pending verifications
  FOR verification IN 
    SELECT * FROM public.email_verifications 
    WHERE status = 'pending'
  LOOP
    -- Check if the email for this user in auth.users matches the new_email in verification
    SELECT * INTO auth_user 
    FROM auth.users 
    WHERE id = verification.user_id;
    
    IF auth_user.id IS NOT NULL THEN
      -- If the current email in auth.users matches the new_email in the verification
      -- This means the verification was completed
      IF auth_user.email = verification.new_email THEN
        UPDATE public.email_verifications
        SET 
          status = 'verified',
          verified_at = NOW()
        WHERE 
          id = verification.id;
          
        RAISE NOTICE 'Periodic scan: Verified email for user %, email %', 
                     auth_user.id, auth_user.email;
      END IF;
      
      -- Check for expired verifications
      IF verification.expires_at < NOW() THEN
        UPDATE public.email_verifications
        SET status = 'expired'
        WHERE id = verification.id;
        
        RAISE NOTICE 'Periodic scan: Expired verification for user %, email %', 
                     verification.user_id, verification.new_email;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Schedule the scan function to run periodically if pg_cron is available
-- Run this separately in the SQL editor, not in this comment block:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('email-verification-sync', E'\*/15 * * * *', 'SELECT scan_for_verified_emails()');

-- Alternative approach: Execute these one by one
-- 1. First create the extension if not exists:
--    CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- 2. Then schedule the job:
--    SELECT cron.schedule('email-verification-sync', '*/15 * * * *', 'SELECT scan_for_verified_emails()'); 