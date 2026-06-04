-- Scheduled rides: optional future pickup time
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Favorite locations for quick rebooking
CREATE TABLE public.favorite_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  label text NOT NULL,
  address text NOT NULL,
  place_id text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorite_locations TO authenticated;
GRANT ALL ON public.favorite_locations TO service_role;

ALTER TABLE public.favorite_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own favorite locations"
  ON public.favorite_locations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_favorite_locations_updated_at
  BEFORE UPDATE ON public.favorite_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();