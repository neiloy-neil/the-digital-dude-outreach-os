CREATE OR REPLACE FUNCTION get_ai_usage_summary(p_user_id UUID, p_daily_from TIMESTAMPTZ, p_monthly_from TIMESTAMPTZ)
RETURNS JSON AS $$
DECLARE
  summary JSON;
BEGIN
  SELECT json_build_object(
    'calls', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from),
    'flashLiteCallsToday', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from AND model = 'gemini-3.1-flash-lite'),
    'flash25CallsToday', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from AND model = 'gemini-2.5-flash'),
    'monthlyCalls', COUNT(id) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_monthly_from),
    'tokens', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_daily_from), 0),
    'monthlyTokens', COALESCE(SUM(tokens_total) FILTER (WHERE skipped = false AND cache_hit = false AND created_at >= p_monthly_from), 0),
    'dailyCacheHits', COUNT(id) FILTER (WHERE cache_hit = true AND created_at >= p_daily_from),
    'monthlyCacheHits', COUNT(id) FILTER (WHERE cache_hit = true AND created_at >= p_monthly_from),
    'dailySkipped', COUNT(id) FILTER (WHERE skipped = true AND created_at >= p_daily_from),
    'monthlySkipped', COUNT(id) FILTER (WHERE skipped = true AND created_at >= p_monthly_from)
  )
  INTO summary
  FROM ai_usage_logs
  WHERE user_id = p_user_id AND created_at >= LEAST(p_monthly_from, p_daily_from);

  RETURN summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
