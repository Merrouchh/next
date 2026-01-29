-- =============================================================================
-- REMOVE TICKET SYSTEM - Database teardown script
-- Run this in Supabase SQL Editor to drop all ticket-related tables, functions,
-- triggers, RLS policies, and realtime publication entries.
-- =============================================================================

-- 1) Remove tables from Realtime publication (if they were enabled)
--    Supabase uses publication "supabase_realtime" - skip these two blocks
--    if you never enabled realtime for tickets.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.ticket_messages;
EXCEPTION
  WHEN undefined_object OR invalid_object_definition OR undefined_table THEN NULL; -- table not in publication
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.tickets;
EXCEPTION
  WHEN undefined_object OR invalid_object_definition OR undefined_table THEN NULL;
END $$;

-- 2) Drop triggers on ticket_messages (then tickets)
--    Replace trigger names if you used different ones (e.g. set_updated_at, handle_updated_at)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tgname FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = 'ticket_messages'
            AND NOT tgisinternal)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.ticket_messages', r.tgname);
  END LOOP;
END $$;
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tgname FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public' AND c.relname = 'tickets'
            AND NOT tgisinternal)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.tickets', r.tgname);
  END LOOP;
END $$;

-- 3) Drop ticket-related functions (signatures may vary; add/remove as needed)
DROP FUNCTION IF EXISTS public.get_all_ticket_unread_counts_admin(uuid);
DROP FUNCTION IF EXISTS public.get_all_ticket_unread_counts(uuid);
DROP FUNCTION IF EXISTS public.mark_ticket_messages_as_read(integer, uuid);
DROP FUNCTION IF EXISTS public.mark_ticket_messages_as_read(bigint, uuid);

-- If you had other ticket functions (e.g. with different arg types), add here:
-- DROP FUNCTION IF EXISTS public.your_function_name(arg_types);

-- 4) Drop tables (CASCADE drops RLS policies, indexes, FKs from other tables)
DROP TABLE IF EXISTS public.ticket_messages CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;

-- Done. Verify with:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'ticket%';
-- (should return no rows)
