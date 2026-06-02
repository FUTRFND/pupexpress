REVOKE EXECUTE ON FUNCTION public.claim_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_referral_code(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_referral_leaderboard(INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_leaderboard(INTEGER) TO authenticated;