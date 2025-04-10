-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS public.increment_view_count(bigint, text, boolean, text, text, text, text);

-- Function to increment view count and handle duplicates
CREATE OR REPLACE FUNCTION public.increment_view_count(
  clip_id BIGINT,
  visitor_id TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  device_fingerprint TEXT DEFAULT NULL,
  ip_address TEXT DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  session_id TEXT DEFAULT NULL
) 
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_duplicate BOOLEAN;
  _current_views BIGINT;
  _is_new_session BOOLEAN := FALSE;
BEGIN
  -- For logged-in users: only check if the SAME user (by visitor_id) has viewed this clip recently
  -- For anonymous users: check both visitor_id AND device fingerprint
  IF NOT is_anonymous THEN
    -- For logged-in users, check only by user ID - allow different users on same device
    SELECT EXISTS (
      SELECT 1 
      FROM clip_views
      WHERE clip_views.clip_id = increment_view_count.clip_id
      AND clip_views.visitor_id = increment_view_count.visitor_id
      AND clip_views.created_at > (NOW() - INTERVAL '6 hours')
    ) INTO _is_duplicate;
  ELSE
    -- For anonymous users, first check by visitor_id
    SELECT EXISTS (
      SELECT 1 
      FROM clip_views
      WHERE clip_views.clip_id = increment_view_count.clip_id
      AND clip_views.visitor_id = increment_view_count.visitor_id
      AND clip_views.created_at > (NOW() - INTERVAL '6 hours')
    ) INTO _is_duplicate;

    -- For anonymous users, if not duplicate by visitor_id, also check fingerprint
    IF device_fingerprint IS NOT NULL AND NOT _is_duplicate THEN
      SELECT EXISTS (
        SELECT 1 
        FROM clip_views
        WHERE clip_views.clip_id = increment_view_count.clip_id
        AND clip_views.device_fingerprint = increment_view_count.device_fingerprint
        AND clip_views.visitor_id LIKE 'anon_%'  -- Only check anonymous users with this fingerprint
        AND clip_views.created_at > (NOW() - INTERVAL '6 hours')
      ) INTO _is_duplicate;
    END IF;
    
    -- For anonymous users with session IDs, check if this is a new session
    IF session_id IS NOT NULL THEN
      SELECT NOT EXISTS (
        SELECT 1 
        FROM clip_views
        WHERE clip_views.clip_id = increment_view_count.clip_id
        AND clip_views.session_id = increment_view_count.session_id
      ) INTO _is_new_session;
      
      -- For a new session, ignore duplicate status (allow new sessions to count)
      IF _is_new_session THEN
        _is_duplicate := FALSE;
      END IF;
    END IF;
  END IF;
  
  -- Only insert if not a duplicate at this point
  IF NOT _is_duplicate THEN
    -- Insert the view into clip_views table
    INSERT INTO clip_views(
      clip_id,
      visitor_id,
      device_fingerprint,
      ip_address,
      user_agent,
      session_id,
      is_new_session
    )
    VALUES (
      clip_id,
      visitor_id,
      device_fingerprint,
      ip_address,
      user_agent,
      session_id,
      _is_new_session
    );
    
    -- Update the views_count in the clips table
    UPDATE clips
    SET views_count = views_count + 1
    WHERE id = clip_id
    RETURNING views_count INTO _current_views;
    
    RETURN _current_views;
  END IF;
  
  -- If this is a duplicate view, return the current view count without incrementing
  SELECT views_count 
  FROM clips 
  WHERE id = clip_id 
  INTO _current_views;
  
  RETURN _current_views;
END;
$$;

-- Add necessary permissions
GRANT EXECUTE ON FUNCTION public.increment_view_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view_count TO service_role; 