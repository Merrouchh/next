-- Create a table for phone verification codes
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  UNIQUE(user_id, phone)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_verification_user_id ON phone_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verification_phone ON phone_verification_codes(phone);

-- Add RLS policies
ALTER TABLE phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only allow service role to access these codes
CREATE POLICY "Service role can CRUD phone verification codes"
  ON phone_verification_codes
  FOR ALL
  TO service_role
  USING (true);
  
-- Only allow a user to see their own verification codes
CREATE POLICY "Users can see their own verification codes"
  ON phone_verification_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- COMMENT on the table and columns
COMMENT ON TABLE phone_verification_codes IS 'Table for storing one-time verification codes for phone number verification';
COMMENT ON COLUMN phone_verification_codes.user_id IS 'Reference to the user''s ID';
COMMENT ON COLUMN phone_verification_codes.phone IS 'The phone number being verified (E.164 format)';
COMMENT ON COLUMN phone_verification_codes.code IS 'One-time verification code';
COMMENT ON COLUMN phone_verification_codes.expires_at IS 'Unix timestamp when the code expires';
COMMENT ON COLUMN phone_verification_codes.attempts IS 'Number of verification attempts made';
COMMENT ON COLUMN phone_verification_codes.created_at IS 'Unix timestamp when the code was created';
