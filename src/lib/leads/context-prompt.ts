import type { Lead } from '@/types/database.types';

export function buildLeadContextPrompt(lead: Partial<Lead>) {
  const services = [
    'custom software development',
    'web app development',
    'automation and internal tools',
    'AI-assisted workflow improvements',
    'website and funnel optimization',
  ];

  const rules = [
    'Keep the email concise and personalized.',
    'Use the lead pain point and our solution angle directly.',
    'Sound human, specific, and low-pressure.',
    'Avoid buzzwords and generic praise.',
    'End with a clear CTA for a quick reply or short call.',
  ];

  return [
    'Write a cold outreach email for The Digital Dude.',
    '',
    `The Digital Dude services: ${services.join(', ')}.`,
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
