-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.user_role AS ENUM ('rider', 'driver', 'both');
CREATE TYPE public.driver_onboarding_status AS ENUM ('not_started', 'pending', 'restricted', 'complete');
CREATE TYPE public.ride_status AS ENUM ('requested', 'accepted', 'driver_en_route', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid', 'payment_pending', 'paid', 'payment_failed', 'refunded');
CREATE TYPE public.transfer_status AS ENUM ('not_ready', 'transfer_pending', 'driver_paid', 'transfer_failed');
CREATE TYPE public.pet_type AS ENUM ('dog', 'cat', 'other');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  profile_photo_url text,
  role public.user_role NOT NULL DEFAULT 'rider',
  stripe_customer_id text,
  stripe_connected_account_id text,
  driver_onboarding_status public.driver_onboarding_status NOT NULL DEFAULT 'not_started',
  driver_payouts_enabled boolean NOT NULL DEFAULT false,
  driver_charges_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =========================================================
-- PETS
-- =========================================================
CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  pet_type public.pet_type NOT NULL DEFAULT 'dog',
  breed text,
  weight_lbs numeric,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT ALL ON public.pets TO service_role;

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own pets"
  ON public.pets FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their own pets"
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own pets"
  ON public.pets FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own pets"
  ON public.pets FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- =========================================================
-- RIDES
-- =========================================================
CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  pickup_address text NOT NULL,
  pickup_place_id text,
  pickup_lat double precision,
  pickup_lng double precision,
  destination_address text NOT NULL,
  destination_place_id text,
  destination_lat double precision,
  destination_lng double precision,
  status public.ride_status NOT NULL DEFAULT 'requested',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  transfer_status public.transfer_status NOT NULL DEFAULT 'not_ready',
  ride_total numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  driver_earnings numeric NOT NULL DEFAULT 0,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  stripe_transfer_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  paid_at timestamptz,
  transferred_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Rider can see their own rides; driver can see assigned rides; drivers can see open requests
CREATE POLICY "Riders see own rides"
  ON public.rides FOR SELECT TO authenticated
  USING (auth.uid() = rider_id);

CREATE POLICY "Drivers see assigned rides"
  ON public.rides FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers see open ride requests"
  ON public.rides FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'requested'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('driver', 'both')
    )
  );

CREATE POLICY "Riders create their own rides"
  ON public.rides FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders update their own rides"
  ON public.rides FOR UPDATE TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Drivers update assigned rides"
  ON public.rides FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- =========================================================
-- RIDE LOCATIONS (live driver pings)
-- =========================================================
CREATE TABLE public.ride_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_locations TO authenticated;
GRANT ALL ON public.ride_locations TO service_role;

ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride participants can view locations"
  ON public.ride_locations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_locations.ride_id
        AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "Drivers insert their own locations"
  ON public.ride_locations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

-- =========================================================
-- MESSAGES
-- =========================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride participants can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = messages.ride_id
        AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

CREATE POLICY "Ride participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = messages.ride_id
        AND (r.rider_id = auth.uid() OR r.driver_id = auth.uid())
    )
  );

-- =========================================================
-- PAYMENTS
-- =========================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  rider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status public.payment_status NOT NULL DEFAULT 'unpaid',
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Read-only for the owning rider; writes happen via service role (Stripe server logic)
CREATE POLICY "Riders view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = rider_id);

-- =========================================================
-- DRIVER EARNINGS
-- =========================================================
CREATE TABLE public.driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  transfer_status public.transfer_status NOT NULL DEFAULT 'not_ready',
  stripe_transfer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  transferred_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_earnings TO authenticated;
GRANT ALL ON public.driver_earnings TO service_role;

ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view their own earnings"
  ON public.driver_earnings FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text,
  ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- updated_at trigger function
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pets_set_updated_at BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, profile_photo_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- Realtime for live updates
-- =========================================================
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.ride_locations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;