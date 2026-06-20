CREATE OR REPLACE FUNCTION increment_email_account_sent_count(p_account_id UUID, p_increment INT DEFAULT 1)
RETURNS void AS $$
  UPDATE email_accounts SET daily_sent_count = COALESCE(daily_sent_count, 0) + p_increment, updated_at = NOW()
  WHERE id = p_account_id;
$$ LANGUAGE sql SECURITY DEFINER;
