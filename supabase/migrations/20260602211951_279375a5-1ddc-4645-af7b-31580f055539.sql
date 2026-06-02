-- ============ referral_codes ============
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_uses INTEGER NOT NULL DEFAULT 0,
  total_savings NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own referral code"
ON public.referral_codes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create their own referral code"
ON public.referral_codes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own referral code"
ON public.referral_codes FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_referral_codes_updated_at
BEFORE UPDATE ON public.referral_codes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ referral_usage ============
CREATE TABLE public.referral_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  used_by_user_id UUID NOT NULL,
  ride_id UUID,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_usage TO authenticated;
GRANT ALL ON public.referral_usage TO service_role;

ALTER TABLE public.referral_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Redeemers view their own usage"
ON public.referral_usage FOR SELECT TO authenticated
USING (auth.uid() = used_by_user_id);

CREATE POLICY "Code owners view usage of their code"
ON public.referral_usage FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.referral_codes rc
  WHERE rc.id = referral_usage.referral_code_id AND rc.user_id = auth.uid()
));

-- ============ profile + ride columns ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- ============ helper: claim/create own code ============
CREATE OR REPLACE FUNCTION public.claim_referral_code()
RETURNS TABLE (code TEXT, total_uses INTEGER, total_savings NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _existing public.referral_codes%ROWTYPE;
  _new_code TEXT;
  _attempts INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _existing FROM public.referral_codes WHERE user_id = _uid LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT _existing.code, _existing.total_uses, _existing.total_savings;
    RETURN;
  END IF;

  LOOP
    _attempts := _attempts + 1;
    _new_code := 'PUPX-' || upper(substr(md5(random()::text), 1, 4));
    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (_uid, _new_code);
      RETURN QUERY SELECT _new_code, 0, 0::NUMERIC;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      IF _attempts >= 10 THEN
        RAISE EXCEPTION 'Could not generate a unique code';
      END IF;
    END;
  END LOOP;
END;
$$;

-- ============ helper: validate a code ============
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code TEXT)
RETURNS TABLE (valid BOOLEAN, owner_name TEXT, reason TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _rc public.referral_codes%ROWTYPE;
  _already TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Not authenticated';
    RETURN;
  END IF;

  SELECT * INTO _rc FROM public.referral_codes
  WHERE code = upper(trim(_code)) AND is_active = true LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Referral code not found';
    RETURN;
  END IF;

  IF _rc.user_id = _uid THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'You cannot use your own referral code';
    RETURN;
  END IF;

  SELECT referred_by_code INTO _already FROM public.profiles
  WHERE id = _uid AND referred_by_code IS NOT NULL LIMIT 1;
  IF _already IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'You have already used a referral code';
    RETURN;
  END IF;

  RETURN QUERY SELECT true,
    COALESCE((SELECT full_name FROM public.profiles WHERE id = _rc.user_id), 'A fellow PupXpress user'),
    NULL::TEXT;
END;
$$;

-- ============ helper: leaderboard ============
CREATE OR REPLACE FUNCTION public.get_referral_leaderboard(_limit INTEGER DEFAULT 50)
RETURNS TABLE (name TEXT, code TEXT, total_uses INTEGER, total_savings NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.full_name, 'Anonymous') AS name,
         rc.code, rc.total_uses, rc.total_savings
  FROM public.referral_codes rc
  LEFT JOIN public.profiles p ON p.id = rc.user_id
  WHERE rc.is_active = true AND rc.total_uses > 0
  ORDER BY rc.total_uses DESC, rc.total_savings DESC
  LIMIT LEAST(GREATEST(_limit, 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard(INTEGER) TO authenticated;