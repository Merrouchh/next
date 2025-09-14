-- Fix event notification spam issue
-- This script cleans up duplicate event notifications and fixes the trigger

-- Step 1: Clean up existing duplicate notifications
-- Delete all individual user notifications, keep only global ones
DELETE FROM public.notifications 
WHERE type IN ('event', 'upload') 
AND recipient_user_id IS NOT NULL;

-- Step 2: Update both trigger functions to create global notifications instead of individual ones

-- Fix upload notification trigger
CREATE OR REPLACE FUNCTION public.notify_new_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uploader_name TEXT;
  clip_title TEXT;
  clip_game TEXT;
BEGIN
  -- Only trigger for public videos that just became complete
  IF NEW.visibility != 'public' OR NEW.status != 'complete' THEN
    RETURN NEW;
  END IF;
  
  -- Check if status changed from not-complete to complete
  IF OLD.status = 'complete' THEN
    RETURN NEW; -- Already was complete, no notification needed
  END IF;

  -- Get uploader username (fallback to 'Someone')
  SELECT username INTO uploader_name FROM public.users WHERE id = NEW.user_id;

  -- Prepare clip title and game
  clip_title := COALESCE(NEW.title, 'Untitled Video');
  clip_game := COALESCE(NEW.game, 'Unknown Game');

  -- Create a single global notification for all users
  INSERT INTO public.notifications (
    title,
    message,
    is_active,
    recipient_user_id,
    type,
    data
  )
  VALUES (
    'New Video Uploaded',
    COALESCE(uploader_name, 'Someone') || ' uploaded a new video: "' || clip_title || '" (' || clip_game || ')',
    TRUE,
    NULL, -- NULL means global notification for all users
    'upload',
    jsonb_build_object(
      'clip_id', NEW.id,
      'clip_title', clip_title,
      'clip_game', clip_game,
      'uploader_name', uploader_name,
      'uploader_id', NEW.user_id,
      'thumbnail_url', NEW.thumbnail_url
    )
  );

  RETURN NEW;
END;
$$;

-- Fix event notification trigger
CREATE OR REPLACE FUNCTION public.notify_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_title TEXT;
  event_game TEXT;
  event_date TEXT;
  team_type TEXT;
BEGIN
  event_title := COALESCE(NEW.title, 'New Event');
  event_game := COALESCE(NEW.game, '');
  event_date := COALESCE(NEW.date::text, '');
  team_type := COALESCE(NEW.team_type, 'solo');

  -- Create a single global notification instead of individual ones
  INSERT INTO public.notifications (
    title,
    message,
    is_active,
    recipient_user_id,
    type,
    data
  )
  VALUES (
    'New event announced',
    'New event: ' || event_title,
    TRUE,
    NULL, -- NULL means global notification for all users
    'event',
    jsonb_build_object(
      'event_id', NEW.id,
      'title', event_title,
      'game', event_game,
      'date', event_date,
      'team_type', team_type,
      'status', NEW.status,
      'image', NEW.image
    )
  );

  RETURN NEW;
END;
$$;

-- Step 3: Recreate both triggers
DROP TRIGGER IF EXISTS trigger_notify_new_event ON public.events;
CREATE TRIGGER trigger_notify_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();

DROP TRIGGER IF EXISTS trigger_notify_new_upload ON public.clips;
CREATE TRIGGER trigger_notify_new_upload
  AFTER UPDATE ON public.clips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_upload();

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.notify_new_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_new_upload() TO authenticated;

-- Step 5: Show cleanup results
SELECT 
  'Notifications after cleanup' as status,
  type,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN recipient_user_id IS NULL THEN 1 END) as global_notifications,
  COUNT(CASE WHEN recipient_user_id IS NOT NULL THEN 1 END) as individual_notifications
FROM public.notifications 
WHERE type IN ('event', 'upload')
GROUP BY type
ORDER BY type;
