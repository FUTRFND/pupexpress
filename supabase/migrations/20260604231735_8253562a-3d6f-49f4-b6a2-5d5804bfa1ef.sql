CREATE TABLE public.driver_presence (
  driver_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  is_online boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_presence TO authenticated;
GRANT ALL ON public.driver_presence TO service_role;

ALTER TABLE public.driver_presence ENABLE ROW LEVEL SECURITY;

-- Drivers manage only their own presence row. Riders never read raw driver
-- locations directly; nearby lookups run server-side via the admin client and
-- only return aggregate counts + an ETA, never individual coordinates.
CREATE POLICY "Drivers manage their own presence"
  ON public.driver_presence
  FOR ALL
  TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE INDEX idx_driver_presence_online ON public.driver_presence (is_online, updated_at);