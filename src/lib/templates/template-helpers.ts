import type { Lead } from '@/types/database.types';

export const TEMPLATE_CATEGORIES = [
  'First Cold Email',
  'Follow-up 1',
  'Follow-up 2',
  'Breakup Email',
  'Proposal Follow-up',
  'Demo Follow-up',
  'CRM Offer',
  'ERP Offer',
  'Website Redesign',
  'SaaS Development',
  'AI Automation',
] as const;

export const TEMPLATE_VARIABLES = [
  '{{first_name}}',
  '{{company_name}}',
  '{{website}}',
  '{{industry}}',
  '{{pain_points}}',
  '{{solution_angle}}',
  '{{recommended_offer}}',
  '{{personalized_first_line}}',
  '{{unsubscribe_url}}',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export function buildTemplateVariableMap(lead?: Partial<Lead> | null) {
  const firstName = lead?.first_name || lead?.decision_maker_name?.split(' ')?.[0] || '';

  return {
    '{{first_name}}': firstName,
    '{{company_name}}': lead?.company_name || lead?.company || '',
    '{{website}}': lead?.website || '',
    '{{industry}}': lead?.industry || '',
    '{{pain_points}}': lead?.pain_points || '',
    '{{solution_angle}}': lead?.ai_solution_angle || lead?.solution || '',
    '{{recommended_offer}}': lead?.recommended_offer || '',
    '{{personalized_first_line}}': lead?.ai_personalized_first_line || '',
    '{{unsubscribe_url}}': '{{unsubscribe_url}}',
  } satisfies Record<TemplateVariable, string>;
}

export function applyTemplateVariables(value: string, lead?: Partial<Lead> | null) {
  const variableMap = buildTemplateVariableMap(lead);
  return Object.entries(variableMap).reduce(
    (current, [variable, replacement]) => current.replaceAll(variable, replacement),
    value || ''
  );
}
