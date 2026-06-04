ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancellation_fee numeric NOT NULL DEFAULT 0;

-- Recreate the rides financial-protection trigger to also cover cancellation_fee.
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
     OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id THEN
    RAISE EXCEPTION 'Financial fields on rides can only be modified by the system.';
  END IF;

  RETURN NEW;
END;
$$;