-- Allow a driver (role 'driver' or 'both') to claim an OPEN, unassigned, requested ride.
-- The existing "Drivers update assigned rides" policy only matches rows already
-- assigned to the driver, so claiming a NULL-driver row needs its own policy.
-- Concurrency is enforced at the row level by the conditional UPDATE in code
-- (WHERE driver_id IS NULL AND status = 'requested'); this policy just authorizes it.
CREATE POLICY "Drivers can claim open rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  driver_id IS NULL
  AND status = 'requested'::ride_status
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY['driver'::user_role, 'both'::user_role])
  )
)
WITH CHECK (
  driver_id = auth.uid()
  AND status = 'accepted'::ride_status
);

-- Helps drivers list open requests and their assigned rides efficiently.
CREATE INDEX IF NOT EXISTS idx_rides_open_requests
  ON public.rides (created_at)
  WHERE driver_id IS NULL AND status = 'requested'::ride_status;

CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON public.rides (driver_id);