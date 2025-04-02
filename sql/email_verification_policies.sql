-- Enable Row Level Security on the email_verifications table
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to see their own verifications
CREATE POLICY email_verifications_select_policy
  ON public.email_verifications 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);
  
-- Allow the service role to do anything with the table
CREATE POLICY email_verifications_service_policy
  ON public.email_verifications 
  FOR ALL 
  TO service_role
  USING (true);
  
-- Allow users to cancel their own verification by updating status
CREATE POLICY email_verifications_update_policy
  ON public.email_verifications 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    status = 'cancelled' AND 
    auth.uid() = user_id
  );
  
-- Create a function to get pending verification for a user
CREATE OR REPLACE FUNCTION get_pending_verification(p_user_id UUID)
RETURNS SETOF public.email_verifications AS $$
BEGIN
  RETURN QUERY 
  SELECT * 
  FROM public.email_verifications
  WHERE user_id = p_user_id
  AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pending_verification TO authenticated; 