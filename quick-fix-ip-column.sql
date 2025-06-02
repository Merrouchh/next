-- Fix for IP address column to allow NULL values
-- Run this in your Supabase SQL editor

-- Allow NULL values in user_ip column
ALTER TABLE push_subscriptions ALTER COLUMN user_ip DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'push_subscriptions' 
  AND column_name = 'user_ip'; 