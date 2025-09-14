-- Add per-user notifications and like trigger

-- 1) Extend notifications table for targeted notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- Helpful index for filtering per user
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user_id ON public.notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 2) Trigger to create a notification when a clip receives a like
CREATE OR REPLACE FUNCTION public.notify_clip_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clip_owner UUID;
  liker_name TEXT;
  clip_title TEXT;
BEGIN
  -- Find the clip owner and title
  SELECT user_id, title INTO clip_owner, clip_title FROM public.clips WHERE id = NEW.clip_id;

  -- If no owner found, or user liked own clip, do nothing
  IF clip_owner IS NULL OR clip_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker username (fallback to 'Someone')
  SELECT username INTO liker_name FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (
    title,
    message,
    is_active,
    recipient_user_id,
    type,
    data
  ) VALUES (
    'New like',
    COALESCE(liker_name, 'Someone') || ' liked your clip: ' || COALESCE(clip_title, 'Untitled'),
    TRUE,
    clip_owner,
    'like',
    jsonb_build_object('clip_id', NEW.clip_id, 'like_id', NEW.id, 'clip_title', clip_title, 'liker_name', liker_name)
  );

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_clip_like() TO authenticated;

-- Create trigger for comment notifications
CREATE OR REPLACE FUNCTION public.notify_clip_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clip_owner UUID;
  commenter_name TEXT;
  clip_title TEXT;
BEGIN
  -- Find the clip owner and title
  SELECT user_id, title INTO clip_owner, clip_title FROM public.clips WHERE id = NEW.clip_id;

  -- If no owner found, or user commented on own clip, do nothing
  IF clip_owner IS NULL OR clip_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter username (fallback to 'Someone')
  SELECT username INTO commenter_name FROM public.users WHERE id = NEW.user_id;

  INSERT INTO public.notifications (
    title,
    message,
    is_active,
    recipient_user_id,
    type,
    data
  ) VALUES (
    'New comment',
    COALESCE(commenter_name, 'Someone') || ' commented on your clip: ' || COALESCE(clip_title, 'Untitled'),
    TRUE,
    clip_owner,
    'comment',
    jsonb_build_object('clip_id', NEW.clip_id, 'comment_id', NEW.id, 'clip_title', clip_title, 'commenter_name', commenter_name, 'comment_content', NEW.content)
  );

  RETURN NEW;
END;
$$;

-- Create trigger on clip_comments table
DROP TRIGGER IF EXISTS trigger_notify_clip_comment ON public.clip_comments;
CREATE TRIGGER trigger_notify_clip_comment
  AFTER INSERT ON public.clip_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_clip_comment();

GRANT EXECUTE ON FUNCTION public.notify_clip_comment() TO authenticated;

-- Create trigger for upload notifications (when video becomes complete and public)
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

-- Create trigger on clips table
DROP TRIGGER IF EXISTS trigger_notify_new_upload ON public.clips;
CREATE TRIGGER trigger_notify_new_upload
  AFTER UPDATE ON public.clips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_upload();

GRANT EXECUTE ON FUNCTION public.notify_new_upload() TO authenticated;

DROP TRIGGER IF EXISTS trg_notify_clip_like ON public.video_likes;
CREATE TRIGGER trg_notify_clip_like
AFTER INSERT ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_clip_like();

-- Create trigger for new event notifications (broadcast to all users except creator)
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

DROP TRIGGER IF EXISTS trigger_notify_new_event ON public.events;
CREATE TRIGGER trigger_notify_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_event();

GRANT EXECUTE ON FUNCTION public.notify_new_event() TO authenticated;


