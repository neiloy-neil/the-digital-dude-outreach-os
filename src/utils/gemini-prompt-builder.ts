import { Campaign, Lead } from '@/types/database.types';

export function buildLeadAnalysisPrompt(
  campaign: Campaign,
  lead: Lead,
  websiteText?: string
): string {
  // Format standard lead fields
  const standardFields = [
    `Name: ${lead.decision_maker_name || lead.first_name || 'Prospect'}`,
    `Title: ${lead.decision_maker_title || ''}`,
    `Email: ${lead.email}`,
    `Company Name: ${lead.company_name || lead.company || ''}`,
    `Website: ${lead.website || ''}`,
    `Industry: ${lead.industry || ''}`,
    `Sub-Industry: ${lead.sub_industry || ''}`,
    `Country/City: ${lead.country || ''} / ${lead.city || ''}`,
    `Company Size: ${lead.company_size || ''}`,
    `Estimated Revenue: ${lead.estimated_revenue || ''}`,
    `Tech Stack: ${lead.tech_stack || ''}`,
    `Pain Points: ${lead.pain_points || ''}`,
    `Solution: ${lead.solution || ''}`,
    `Lead Source: ${lead.lead_source || ''}`,
    `Priority: ${lead.priority || ''}`,
    `Solution Score: ${lead.solution_score ?? ''}`,
    `Solution Fit Score: ${lead.solution_fit_score ?? ''}`,
    `Notes: ${lead.notes || ''}`
  ].filter(line => !line.endsWith(': ')).join('\n');

  // Format raw_data fields
  const rawDataFields = Object.entries(lead.raw_data || {})
    .filter(([_, val]) => val !== null && val !== undefined && val !== '')
    .map(([key, val]) => `- ${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
    .join('\n');

  const offersAndServices = `
The Digital Dude offers:
- Custom web applications
- Enterprise Resource Planning (ERP) systems
- Customer Relationship Management (CRM) systems
- Software-as-a-Service (SaaS) platforms
- Booking portals
- Client portals
- AI chatbots
- Workflow automation
- Custom dashboards
- Website redesign and optimization
`;

  return `You are an expert B2B cold outreach strategist for a software agency called The Digital Dude.
${offersAndServices}

Your task:
Analyze the lead data provided below, select the single best offer/service that fits this lead's profile, determine the strongest business pain point, use the provided solution context, define the tailored outreach solution angle, write a high-level personalization strategy, and draft a short, natural, personalized email body and subject line.

---
CAMPAIGN DETAILS:
- Campaign Name: ${campaign.name}
- Target Industry: ${campaign.target_industry || 'General B2B'}
- Campaign Offer Pitching: ${campaign.offer_type || 'Custom Software Development'}

---
LEAD DATA (STANDARD FIELDS):
${standardFields}

---
LEAD DATA (RAW IMPORTED FIELDS):
${rawDataFields || 'None'}

---
${websiteText ? `LEAD WEBSITE HOMEPAGE TEXT CRAWLED:\n${websiteText.slice(0, 4000)}\n---` : 'No website text available.'}

---
STRICT WRITING RULES:
1. Do NOT invent/hallucinate any facts about the lead or their company. Rely ONLY on the provided Lead Data and Website Text.
2. Focus on the single strongest pain point or tech stack issue you see in the data. Do not mention multiple unrelated pain points.
3. The email body must be brief (under 130 words), highly conversational, and sound completely human (avoid robotic outreach speak, avoid "Hope this finds you well", "Dear [Name]", exaggerated pitches, or generic corporate filler).
4. Start the email with the "personalized_first_line". It should be a completely natural, low-pressure observation about their website, role, tech stack, or pain points.
5. The call to action (CTA) must be soft and low friction (e.g. "Open to a quick email dialogue?" or "Would you be open to looking at a mock dashboard next week?").
6. You must include the exact placeholder token "{{unsubscribe_url}}" at the very bottom of the email body.

Respond ONLY with a valid JSON object matching this schema. Do not enclose the output in markdown code blocks like \`\`\`json. Output raw JSON text:
{
  "company_summary": "A 1-2 sentence description of what the lead's company does.",
  "lead_analysis": "A brief analysis of the company's status, tech stack indicators, and business needs.",
  "pain_point_summary": "The main pain point identified from the lead's data.",
  "solution_angle": "How The Digital Dude can help solve that specific pain point.",
  "outreach_strategy": "1-2 sentences explaining why this personalization strategy is chosen.",
  "personalized_first_line": "The natural introductory sentence for the email.",
  "recommended_offer": "The chosen offer from The Digital Dude list that best fits.",
  "subject": "A personalized, intriguing, short email subject line (do not use brackets or template tokens).",
  "email_body": "The complete personalized email body. Start with the personalized first line. End with the soft CTA. Include the {{unsubscribe_url}} placeholder at the bottom.",
  "cta": "The low-friction CTA used in the email.",
  "confidence_score": 85, // Integer from 0 to 100 based on data quality
  "data_quality_notes": "Note if the data is weak or contains gaps, or why you rated the confidence score.",
  "missing_data": ["industry", "tech_stack"] // List of useful standard fields that were missing or empty in lead data
}`;
}
