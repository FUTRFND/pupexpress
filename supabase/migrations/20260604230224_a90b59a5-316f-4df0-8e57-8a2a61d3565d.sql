-- Helper: is the current DB session a privileged/system role?
-- Must be SECURITY INVOKER (default) so current_user reflects the real session
-- role set by PostgREST (authenticated / anon / service_role) rather than a
-- function owner.
CREATE OR REPLACE FUNCTION public.current_is_privileged()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user IN (
    'service_role', 'postgres', 'supabase_admin',
    'supabase_auth_admin', 'supabase_storage_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Lock financial columns on public.rides to the service role.
-- Riders/drivers may still update status, timestamps, cancellation, etc., but
-- never the money columns. The app writes those exclusively via the admin
-- (service-role) client in server functions / the verified webhook.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_ride_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Clients cannot price their own ride; force safe defaults.
    NEW.ride_total := 0;
    NEW.platform_fee := 0;
    NEW.driver_earnings := 0;
    NEW.tip_amount := 0;
    NEW.payment_status := 'unpaid';
    NEW.transfer_status := 'not_ready';
    NEW.paid_at := NULL;
    NEW.transferred_at := NULL;
    NEW.stripe_payment_intent_id := NULL;
    NEW.stripe_checkout_session_id := NULL;
    NEW.stripe_transfer_id := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: reject any change to a protected column.
  IF NEW.ride_total IS DISTINCT FROM OLD.ride_total
     OR NEW.platform_fee IS DISTINCT FROM OLD.platform_fee
     OR NEW.driver_earnings IS DISTINCT FROM OLD.driver_earnings
     OR NEW.tip_amount IS DISTINCT FROM OLD.tip_amount
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.transfer_status IS DISTINCT FROM OLD.transfer_status
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.transferred_at IS DISTINCT FROM OLD.transferred_at
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id THEN
    RAISE EXCEPTION 'Financial fields on rides can only be modified by the system.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_ride_financials_trg ON public.rides;
CREATE TRIGGER protect_ride_financials_trg
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.protect_ride_financials();

-- ---------------------------------------------------------------------------
-- Lock Stripe / payout columns on public.profiles to the service role.
-- Users keep control of full_name, phone, photo, role, etc.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_payout_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.current_is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.stripe_connected_account_id := NULL;
    NEW.stripe_customer_id := NULL;
    NEW.driver_payouts_enabled := false;
    NEW.driver_charges_enabled := false;
    NEW.driver_onboarding_status := 'not_started';
    RETURN NEW;
  END IF;

  IF NEW.stripe_connected_account_id IS DISTINCT FROM OLD.stripe_connected_account_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.driver_payouts_enabled IS DISTINCT FROM OLD.driver_payouts_enabled
     OR NEW.driver_charges_enabled IS DISTINCT FROM OLD.driver_charges_enabled
     OR NEW.driver_onboarding_status IS DISTINCT FROM OLD.driver_onboarding_status THEN
    RAISE EXCEPTION 'Payout/Stripe fields on profiles can only be modified by the system.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_payout_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_payout_fields_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_payout_fields();