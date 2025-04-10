-- Add phone_verification_required column to the events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS phone_verification_required BOOLEAN DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN public.events.phone_verification_required IS 'Determines if phone verification is required for event registration';

-- Update existing events to have phone verification disabled by default
-- This ensures backward compatibility with existing events
UPDATE public.events 
SET phone_verification_required = false
WHERE phone_verification_required IS NULL; 