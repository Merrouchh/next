-- Function to check email verification status
CREATE OR REPLACE FUNCTION check_email_verification_status()
RETURNS TRIGGER AS $$
DECLARE
  auth_user RECORD;
BEGIN
  -- Only check for pending verifications
  IF NEW.status = 'pending' THEN
    -- Try to get the user record
    BEGIN
      SELECT id, email INTO auth_user 
      FROM auth.users 
      WHERE id = NEW.user_id 
      LIMIT 1;
      
      -- If found, check if already verified
      IF FOUND AND auth_user.email = NEW.new_email THEN
        -- Email is already verified in auth.users
        NEW.status := 'verified';
        NEW.verified_at := NOW();
        RAISE NOTICE 'Email already verified in auth.users, marking as verified: %', NEW.new_email;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If error occurs, just continue (don't block the insert/update)
      RAISE NOTICE 'Error checking auth.users table: %', SQLERRM;
    END;
  END IF;
  
  -- Check for expired verifications
  IF NEW.status = 'pending' AND NEW.expires_at IS NOT NULL AND NEW.expires_at < NOW() THEN
    -- Verification has expired
    NEW.status := 'expired';
    RAISE NOTICE 'Verification expired for email: %', NEW.new_email;
  END IF;
  
  -- Set timestamps for status changes
  IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := NOW();
  ELSIF NEW.status = 'verified' AND NEW.verified_at IS NULL THEN
    NEW.verified_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_email_verification_status ON email_verifications;

-- Create the trigger
CREATE TRIGGER update_email_verification_status
BEFORE INSERT OR UPDATE ON email_verifications
FOR EACH ROW
EXECUTE FUNCTION check_email_verification_status();

-- Add a scheduled function to periodically check for expired verifications
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
  -- Update expired verifications
  UPDATE email_verifications 
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 