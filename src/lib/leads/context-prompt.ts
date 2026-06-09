import type { Lead } from '@/types/database.types';

export type CompanyPromptContext = {
  companyName?: string | null;
  website?: string | null;
  description?: string | null;
  offersServices?: string | null;
  valueProposition?: string | null;
  targetCustomers?: string | null;
  proofPoints?: string | null;
};

function companyContextLines(companyContext?: CompanyPromptContext | null) {
  const fallbackServices = [
    'custom software development',
    'web app development',
    'automation and internal tools',
    'AI-assisted workflow improvements',
    'website and funnel optimization',
  ].join(', ');

  const context = companyContext || {};

  return [
    `- Company name: ${context.companyName || 'ReachMira outreach'}`,
    `- Website: ${context.website || 'N/A'}`,
    `- What we do: ${context.description || 'B2B outreach and software services'}`,
    `- Offers and services: ${context.offersServices || fallbackServices}`,
    `- Value proposition: ${context.valueProposition || 'Help prospects improve operations, workflows, and growth with practical software and automation.'}`,
    `- Best-fit customers: ${context.targetCustomers || 'B2B teams with workflow, lead generation, or operational bottlenecks.'}`,
    `- Proof points or differentiators: ${context.proofPoints || 'N/A'}`,
  ];
}

export function buildLeadContextPrompt(lead: Partial<Lead>, companyContext?: CompanyPromptContext | null) {

  const rules = [
    'Keep the email concise and personalized.',
    'Use the lead pain point and our solution angle directly.',
    'Sound human, specific, and low-pressure.',
    'Avoid buzzwords and generic praise.',
    'End with a clear CTA for a quick reply or short call.',
  ];

  return [
    'Write a cold outreach email using the sender company context and lead context below.',
    '',
    'Sender company context:',
    ...companyContextLines(companyContext),
    '',
    'Lead company info:',
    `- Company: ${lead.company_name || lead.company || 'Unknown company'}`,
    `- Website: ${lead.website || 'N/A'}`,
    `- Industry: ${lead.industry || 'N/A'}`,
    `- Decision maker: ${lead.decision_maker_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'N/A'}`,
    `- Title: ${lead.decision_maker_title || 'N/A'}`,
    '',
    'Lead context:',
    `- Pain point: ${lead.pain_points || 'N/A'}`,
    `- Solution angle: ${lead.ai_solution_angle || 'N/A'}`,
    `- Recommended offer: ${lead.recommended_offer || 'N/A'}`,
    `- Notes: ${lead.notes || 'N/A'}`,
    '',
    'Email writing rules:',
    ...rules.map((rule) => `- ${rule}`),
  ].join('\n');
}

export function buildLeadSummary(lead: Partial<Lead>) {
  return [
    `Company: ${lead.company_name || lead.company || 'Unknown company'}`,
    `Website: ${lead.website || 'N/A'}`,
    `Industry: ${lead.industry || 'N/A'}`,
    `Contact: ${lead.decision_maker_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'N/A'}`,
    `Title: ${lead.decision_maker_title || 'N/A'}`,
    `Email: ${lead.email || 'N/A'}`,
    `Status: ${lead.status || 'N/A'}`,
    `Priority: ${lead.priority || 'N/A'}`,
    `Pain point: ${lead.pain_points || 'N/A'}`,
    `Solution angle: ${lead.ai_solution_angle || lead.solution || 'N/A'}`,
    `Recommended offer: ${lead.recommended_offer || 'N/A'}`,
    `Notes: ${lead.notes || 'N/A'}`,
  ].join('\n');
}

export function buildFollowUpPrompt(
  lead: Partial<Lead>,
  previousEmail?: { subject?: string | null; body_text?: string | null; body_html?: string | null; sent_at?: string | null },
  companyContext?: CompanyPromptContext | null
) {
  const previousBody = previousEmail?.body_text || previousEmail?.body_html?.replace(/<[^>]*>/g, '') || 'N/A';

  return [
    'Write a concise follow-up email using the sender company context and lead context below.',
    '',
    'Sender company context:',
    ...companyContextLines(companyContext),
    '',
    buildLeadSummary(lead),
    '',
    'Previous email:',
    `Subject: ${previousEmail?.subject || 'N/A'}`,
    `Sent at: ${previousEmail?.sent_at || 'N/A'}`,
    `Body: ${previousBody}`,
    '',
    'Keep it short, human, and easy to reply to.',
  ].join('\n');
}
