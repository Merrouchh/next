-- Create the scheduled job using pg_cron extension
-- Make sure the pg_cron extension is enabled in your Supabase project

-- Execute this in the Supabase SQL Editor

-- First, check if pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run every 10 minutes
SELECT cron.schedule('cleanup-email-verifications', '*/10 * * * *', 'SELECT cleanup_email_verifications()');

-- Note: If pg_cron is not available, you can run this cleanup either:
-- 1. Through a server-side cron job calling an API endpoint
-- 2. As part of a transaction when a user loads the profile page 