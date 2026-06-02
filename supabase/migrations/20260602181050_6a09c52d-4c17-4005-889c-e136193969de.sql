-- Idempotency backstops for payments and driver transfers.
-- One payment row and one earnings row per ride; prevents duplicate
-- inserts even if a webhook is delivered more than once.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_ride_id
  ON public.payments (ride_id)
  WHERE ride_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_earnings_ride_id
  ON public.driver_earnings (ride_id)
  WHERE ride_id IS NOT NULL;

-- Fast lookups by Stripe identifiers (webhook handlers resolve records by these).
CREATE INDEX IF NOT EXISTS idx_rides_checkout_session
  ON public.rides (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rides_payment_intent
  ON public.rides (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_connected_account
  ON public.profiles (stripe_connected_account_id)
  WHERE stripe_connected_account_id IS NOT NULL;