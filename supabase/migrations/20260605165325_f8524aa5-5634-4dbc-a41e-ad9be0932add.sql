-- 1) Lock the profiles.role column to the system (block client-side role escalation)
CREATE OR REPLACE FUNCTION public.protect_profile_payout_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    NEW.role := 'rider';
    RETURN NEW;
  END IF;

  IF NEW.stripe_connected_account_id IS DISTINCT FROM OLD.stripe_connected_account_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.driver_payouts_enabled IS DISTINCT FROM OLD.driver_payouts_enabled
     OR NEW.driver_charges_enabled IS DISTINCT FROM OLD.driver_charges_enabled
     OR NEW.driver_onboarding_status IS DISTINCT FROM OLD.driver_onboarding_status
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Payout/Stripe/role fields on profiles can only be modified by the system.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Lock the rides.referral_code column to the system (block client-side code injection)
CREATE OR REPLACE FUNCTION public.protect_ride_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.current_is_privileged() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.ride_total := 0;
    NEW.platform_fee := 0;
    NEW.driver_earnings := 0;
    NEW.tip_amount := 0;
    NEW.cancellation_fee := 0;
    NEW.payment_status := 'unpaid';
    NEW.transfer_status := 'not_ready';
    NEW.paid_at := NULL;
    NEW.transferred_at := NULL;
    NEW.stripe_payment_intent_id := NULL;
    NEW.stripe_checkout_session_id := NULL;
    NEW.stripe_transfer_id := NULL;
    NEW.referral_code := NULL;
    RETURN NEW;
  END IF;

  IF NEW.ride_total IS DISTINCT FROM OLD.ride_total
     OR NEW.platform_fee IS DISTINCT FROM OLD.platform_fee
     OR NEW.driver_earnings IS DISTINCT FROM OLD.driver_earnings
     OR NEW.tip_amount IS DISTINCT FROM OLD.tip_amount
     OR NEW.cancellation_fee IS DISTINCT FROM OLD.cancellation_fee
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.transfer_status IS DISTINCT FROM OLD.transfer_status
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.transferred_at IS DISTINCT FROM OLD.transferred_at
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Financial/referral fields on rides can only be modified by the system.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Ratings: a rider may only rate the actual driver on their own completed ride
DROP POLICY IF EXISTS "Riders create their own ratings" ON public.ride_ratings;
CREATE POLICY "Riders create their own ratings"
ON public.ride_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = rider_id
  AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_ratings.ride_id
      AND r.rider_id = auth.uid()
      AND r.driver_id = ride_ratings.driver_id
  )
);

-- 4) Remove direct client EXECUTE on internal trigger/helper functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_is_privileged() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_payout_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_ride_financials() FROM PUBLIC, anon, authenticated;