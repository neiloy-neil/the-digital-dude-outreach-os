-- Atomic AI-call budget reservation, replacing the read-then-decide race in
-- analyze-lead.ts (an in-process cache + a separate count query, both of
-- which let concurrent bulk-analyze calls all see the same stale count and
-- overshoot the configured daily/monthly/deep limits).
--
-- Reserves a slot by inserting a real ai_usage_logs row (skipped = false)
-- inside the same advisory-locked transaction as the count check, so a
-- concurrent caller waiting on the lock sees this reservation counted
-- before it runs its own check. Returns the reservation's row id (to be
-- updated with real token/cost details once the Gemini call completes) or
-- null if the budget is exhausted (nothing inserted).
CREATE OR REPLACE FUNCTION reserve_ai_call_budget(
  p_user_id uuid,
  p_daily_limit int,
  p_monthly_limit int,
  p_daily_deep_limit int,
  p_is_deep boolean,
  p_model text
) RETURNS jsonb AS $$
DECLARE
  v_daily_from timestamptz := date_trunc('day', now());
  v_monthly_from timestamptz := date_trunc('month', now());
  v_daily_calls int;
  v_monthly_calls int;
  v_daily_deep_calls int;
  v_reservation_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  SELECT count(*) INTO v_daily_calls FROM ai_usage_logs
    WHERE user_id = p_user_id AND skipped = false AND cache_hit = false AND created_at >= v_daily_from;

  SELECT count(*) INTO v_monthly_calls FROM ai_usage_logs
    WHERE user_id = p_user_id AND skipped = false AND cache_hit = false AND created_at >= v_monthly_from;

  SELECT count(*) INTO v_daily_deep_calls FROM ai_usage_logs
    WHERE user_id = p_user_id AND skipped = false AND cache_hit = false
      AND model = 'gemini-2.5-flash' AND created_at >= v_daily_from;

  IF p_daily_limit > 0 AND v_daily_calls >= p_daily_limit THEN
    RETURN jsonb_build_object(
      'reservation_id', null, 'daily_calls', v_daily_calls, 'monthly_calls', v_monthly_calls,
      'daily_deep_calls', v_daily_deep_calls, 'reason', 'daily'
    );
  END IF;

  IF p_monthly_limit > 0 AND v_monthly_calls >= p_monthly_limit THEN
    RETURN jsonb_build_object(
      'reservation_id', null, 'daily_calls', v_daily_calls, 'monthly_calls', v_monthly_calls,
      'daily_deep_calls', v_daily_deep_calls, 'reason', 'monthly'
    );
  END IF;

  IF p_is_deep AND p_daily_deep_limit > 0 AND v_daily_deep_calls >= p_daily_deep_limit THEN
    RETURN jsonb_build_object(
      'reservation_id', null, 'daily_calls', v_daily_calls, 'monthly_calls', v_monthly_calls,
      'daily_deep_calls', v_daily_deep_calls, 'reason', 'deep'
    );
  END IF;

  INSERT INTO ai_usage_logs (user_id, model, model_used, operation, action, skipped, cache_hit, created_at)
  VALUES (p_user_id, p_model, p_model, 'analyze_lead', 'analyze_lead', false, false, now())
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation_id, 'daily_calls', v_daily_calls, 'monthly_calls', v_monthly_calls,
    'daily_deep_calls', v_daily_deep_calls, 'reason', null
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
