CREATE TABLE public.ride_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL UNIQUE,
  rider_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ride_ratings TO authenticated;
GRANT ALL ON public.ride_ratings TO service_role;

ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders create their own ratings"
ON public.ride_ratings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders update their own ratings"
ON public.ride_ratings
FOR UPDATE
TO authenticated
USING (auth.uid() = rider_id)
WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders view their own ratings"
ON public.ride_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = rider_id);

CREATE POLICY "Drivers view ratings about them"
ON public.ride_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

CREATE POLICY "Admins view all ratings"
ON public.ride_ratings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_ride_ratings_updated_at
BEFORE UPDATE ON public.ride_ratings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ride_ratings_driver ON public.ride_ratings (driver_id);