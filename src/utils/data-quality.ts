export function calculateLeadDataQuality(lead: {
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
}): { score: number; label: 'poor' | 'fair' | 'good' | 'excellent' } {
  let score = 0;

  if (lead.email && lead.email.includes('@')) score += 25;
  
  const hasCompany = lead.company_name || lead.company;
  if (hasCompany) score += 15;
  
  if (lead.website) score += 15;
  if (lead.decision_maker_name) score += 10;
  if (lead.decision_maker_title) score += 10;
  if (lead.industry) score += 5;
  if (lead.pain_points) score += 10;
  if (lead.solution) score += 5;
  if (lead.tech_stack) score += 5;
  
  const hasNotesOrTags = lead.notes || lead.tags;
  if (hasNotesOrTags) score += 5;

  let label: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
  if (score >= 80) label = 'excellent';
  else if (score >= 60) label = 'good';
  else if (score >= 35) label = 'fair';

  return { score, label };
}
