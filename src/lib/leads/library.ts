export const LEAD_DESTINATION_FIELDS = [
  { key: 'email', label: 'Email Address (Required)', aliases: ['email', 'email address', 'email_address', 'work email', 'contact email', 'mail'] },
  { key: 'first_name', label: 'First Name', aliases: ['first_name', 'first name', 'firstname', 'first'] },
  { key: 'last_name', label: 'Last Name', aliases: ['last_name', 'last name', 'lastname', 'last'] },
  { key: 'company_name', label: 'Company Name', aliases: ['company_name', 'company name', 'company', 'business name', 'org', 'organization', 'firm'] },
  { key: 'website', label: 'Website URL', aliases: ['website', 'web', 'site', 'url', 'domain'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  { key: 'sub_industry', label: 'Sub-Industry', aliases: ['sub_industry', 'sub industry', 'subsector'] },
  { key: 'country', label: 'Country', aliases: ['country', 'nation'] },
  { key: 'city', label: 'City', aliases: ['city', 'town', 'location'] },
  { key: 'company_size', label: 'Company Size', aliases: ['company_size', 'company size', 'size', 'employees'] },
  { key: 'estimated_revenue', label: 'Estimated Revenue', aliases: ['estimated_revenue', 'estimated revenue', 'revenue', 'rev'] },
  { key: 'decision_maker_name', label: 'Decision Maker Name', aliases: ['decision_maker_name', 'decision maker name', 'contact name', 'contact', 'name', 'full name', 'fullname', 'full_name'] },
  { key: 'decision_maker_title', label: 'Decision Maker Title', aliases: ['decision_maker_title', 'decision maker title', 'title', 'role', 'position'] },
  { key: 'linkedin_url', label: 'LinkedIn URL', aliases: ['linkedin_url', 'linkedin url', 'linkedin'] },
  { key: 'tech_stack', label: 'Tech Stack', aliases: ['tech_stack', 'tech stack', 'technologies', 'tech'] },
  { key: 'pain_points', label: 'Pain Points / Trigger', aliases: ['pain_points', 'pain points', 'pains', 'trigger', 'pain points / trigger', 'trigger event'] },
  { key: 'solution', label: 'Solution / Offer', aliases: ['solution', 'our solution', 'proposed solution', 'recommended solution', 'offer solution'] },
  { key: 'solution_score', label: 'Solution Score (0-100)', aliases: ['solution_score', 'solution score'] },
  { key: 'solution_fit_score', label: 'Solution Fit Score (0-100)', aliases: ['solution_fit_score', 'solution fit score'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['lead_source', 'lead source', 'source'] },
  { key: 'qc_by', label: 'QC By', aliases: ['qc_by', 'qc by', 'qc'] },
  { key: 'outreach_channel', label: 'Outreach Channel', aliases: ['outreach_channel', 'outreach channel', 'channel'] },
  { key: 'outreach_status', label: 'Outreach Status', aliases: ['outreach_status', 'outreach status', 'outreach'] },
  { key: 'priority', label: 'Priority', aliases: ['priority', 'lead priority'] },
  { key: 'assigned_to', label: 'Assigned To', aliases: ['assigned_to', 'assigned to', 'assignee'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comment', 'remarks'] },
  { key: 'follow_up_note', label: 'Follow-up Note', aliases: ['follow_up_note', 'follow up note', 'follow-up note', 'reminder note'] },
  { key: 'lead_owner', label: 'Lead Owner', aliases: ['lead_owner', 'lead owner', 'owner'] },
  { key: 'deal_size', label: 'Deal Size', aliases: ['deal_size', 'deal size', 'pipeline value', 'value'] },
  { key: 'pipeline_stage', label: 'Pipeline Stage', aliases: ['pipeline_stage', 'pipeline stage', 'stage'] },
] as const;

export type LeadQualityLabel = 'poor' | 'fair' | 'good' | 'excellent';
export type LeadReadiness =
  | 'ready_to_send'
  | 'needs_email_verification'
  | 'missing_pain_point'
  | 'missing_solution_angle'
  | 'needs_personalization'
  | 'follow_up_due'
  | 'already_contacted'
  | 'do_not_contact';

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((cell) => cell.replace(/^["']|["']$/g, '').trim());
}

export function autoMapHeaders(availableHeaders: string[]) {
  const mappings: Record<string, string> = {};
  LEAD_DESTINATION_FIELDS.forEach((field) => {
    const matchingHeader = availableHeaders.find((header) => {
      const lowerHeader = header.toLowerCase();
      return field.aliases.some(
        (alias) =>
          lowerHeader === alias ||
          lowerHeader.replace(/[?_\s-]/g, '') === alias.replace(/[?_\s-]/g, '')
      );
    });
    if (matchingHeader) {
      mappings[field.key] = matchingHeader;
    }
  });
  return mappings;
}

export function calculateLeadQuality(lead: {
  email?: string | null;
  company_name?: string | null;
  company?: string | null;
  website?: string | null;
  decision_maker_name?: string | null;
  decision_maker_title?: string | null;
  industry?: string | null;
  pain_points?: string | null;
  solution?: string | null;
  tech_stack?: string | null;
  notes?: string | null;
  tags?: string | null;
}): { score: number; label: LeadQualityLabel } {
  let score = 0;

  if (lead.email && lead.email.includes('@')) score += 25;
  if (lead.company_name || lead.company) score += 15;
  if (lead.website) score += 10;
  if (lead.decision_maker_name) score += 15;
  if (lead.decision_maker_title) score += 10;
  if (lead.industry) score += 5;
  if (lead.pain_points) score += 10;
  if (lead.solution) score += 5;
  if (lead.tech_stack) score += 5;
  if (lead.notes || lead.tags) score += 5;

  score = Math.max(0, Math.min(100, score));

  let label: LeadQualityLabel = 'poor';
  if (score >= 85) label = 'excellent';
  else if (score >= 70) label = 'good';
  else if (score >= 40) label = 'fair';

  return { score, label };
}

export function getLeadReadiness(lead: {
  status?: string | null;
  email_verification_status?: string | null;
  pain_points?: string | null;
  solution?: string | null;
  recommended_offer?: string | null;
  manual_email_subject?: string | null;
  manual_email_body?: string | null;
  manual_email_approved?: boolean | null;
  emails_sent_count?: number | null;
  next_follow_up_at?: string | null;
  next_follow_up_date?: string | null;
  next_email_at?: string | null;
}): LeadReadiness {
  const status = String(lead.status || '').toLowerCase();
  
  // 1. Do Not Contact
  if (
    ['do_not_contact', 'unsubscribed', 'bounced', 'excluded'].includes(status)
  ) {
    return 'do_not_contact';
  }

  // 2. Follow-up Due
  const nextFollowUp = lead.next_follow_up_at || lead.next_follow_up_date || lead.next_email_at;
  const hasSent = lead.emails_sent_count && lead.emails_sent_count > 0;
  const isSentStatus = ['mail_sent', 'manual_email_sent', 'follow_up_1_sent', 'follow_up_2_sent', 'follow_up_3_sent', 'sent', 'manually_sent'].includes(status);
  
  if ((hasSent || isSentStatus) && nextFollowUp && new Date(nextFollowUp).getTime() <= Date.now() && status !== 'replied') {
    return 'follow_up_due';
  }

  // 3. Already Contacted
  if (hasSent || isSentStatus || status === 'replied') {
    return 'already_contacted';
  }

  // 4. Needs Email Verification
  if (
    !lead.email_verification_status ||
    ['not_checked', 'unknown', 'failed'].includes(lead.email_verification_status)
  ) {
    return 'needs_email_verification';
  }

  // 5. Missing Pain Point
  if (!lead.pain_points || !lead.pain_points.trim()) {
    return 'missing_pain_point';
  }

  // 6. Missing Solution Angle
  if ((!lead.solution || !lead.solution.trim()) && (!lead.recommended_offer || !lead.recommended_offer.trim())) {
    return 'missing_solution_angle';
  }

  // 7. Needs Personalization
  const hasPersonalizedDraft = lead.manual_email_subject && lead.manual_email_body;
  const isApproved = lead.manual_email_approved || status === 'email_approved';
  
  if (!hasPersonalizedDraft || !isApproved) {
    return 'needs_personalization';
  }

  // 8. Ready to Send
  return 'ready_to_send';
}

export function dedupeLeadRows(rows: Record<string, unknown>[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const email = String(row.email || '').toLowerCase().trim();
    const website = String(row.website || '').toLowerCase().trim().replace(/^https?:\/\//, '');
    const company = String(row.company_name || row.company || '').toLowerCase().trim();
    const city = String(row.city || '').toLowerCase().trim();
    const linkedin = String(row.linkedin_url || '').toLowerCase().trim();
    const key = [email, website, `${company}:${city}`, linkedin].filter(Boolean).join('|');
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
