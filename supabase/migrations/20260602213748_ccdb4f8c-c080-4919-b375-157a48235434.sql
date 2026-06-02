-- Ensure full row payloads are delivered on realtime updates/deletes
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.ride_locations REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (skip if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ride_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_locations;
  END IF;
END $$;