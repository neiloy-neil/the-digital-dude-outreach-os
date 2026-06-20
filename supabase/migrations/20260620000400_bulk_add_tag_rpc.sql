CREATE OR REPLACE FUNCTION bulk_add_tag_to_leads(p_lead_ids UUID[], p_new_tag TEXT)
RETURNS void AS $$
  UPDATE leads
  SET tags = (
    SELECT array_to_string(array_agg(DISTINCT trim(t)), ', ')
    FROM unnest(string_to_array(COALESCE(tags, ''), ',') || p_new_tag) t
    WHERE trim(t) != ''
  ),
  updated_at = NOW()
  WHERE id = ANY(p_lead_ids);
$$ LANGUAGE sql SECURITY DEFINER;
