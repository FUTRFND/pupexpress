-- ============ enum ============
DO $$ BEGIN
  CREATE TYPE public.driver_verification_status AS ENUM ('not_started', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ driver_verifications ============
CREATE TABLE public.driver_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  driver_photo_url TEXT,
  drivers_license_url TEXT,
  insurance_url TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_color TEXT,
  license_plate TEXT,
  vehicle_photo_url TEXT,
  status public.driver_verification_status NOT NULL DEFAULT 'not_started',
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_verifications TO authenticated;
GRANT ALL ON public.driver_verifications TO service_role;

ALTER TABLE public.driver_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view their own verification"
ON public.driver_verifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Drivers create their own verification"
ON public.driver_verifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Drivers update their own verification"
ON public.driver_verifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_driver_verifications_updated_at
BEFORE UPDATE ON public.driver_verifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ storage policies: driver-documents (private, per-user folder) ============
CREATE POLICY "Drivers read their own documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers upload their own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers update their own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Drivers delete their own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-documents' AND auth.uid()::text = (storage.foldername(name))[1]);