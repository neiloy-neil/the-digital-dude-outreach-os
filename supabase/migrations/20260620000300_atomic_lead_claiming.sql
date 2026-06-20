CREATE OR REPLACE FUNCTION claim_leads_for_ai(p_limit INT)
RETURNS SETOF leads AS $$
  UPDATE leads
  SET ai_status = 'processing', processing_started_at = NOW(), processing_error = NULL
  WHERE id IN (
    SELECT id FROM leads
    WHERE (ai_status = 'pending')
       OR (ai_status = 'processing' AND processing_started_at < NOW() - INTERVAL '15 minutes')
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER;
