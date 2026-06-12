import { firecrawlSearch } from './firecrawl';
import { GoogleGenAI } from '@google/genai';
import { AI_DEFAULT_MODEL } from '@/lib/ai/efficiency';

export interface EnrichedCompanyData {
  company_name: string | null;
  industry: string | null;
  employee_count: string | null;
  year_founded: number | null;
  funding_stage: string | null;
  total_raised: string | null;
  tech_stack: string[] | null;
  ceo_name: string | null;
  pain_points: string | null;
  ai_solution_angle: string | null;
  recommended_offer: string | null;
  ai_company_summary: string | null;
  ai_lead_analysis: string | null;
  ai_outreach_strategy: string | null;
  ai_personalized_first_line: string | null;
}

export async function runEnrichmentPipeline(domainOrEmail: string, geminiApiKey: string): Promise<EnrichedCompanyData> {
  const target = domainOrEmail.split('@').pop() || domainOrEmail;

  // Phase 1: Parallel Web Searches via Firecrawl
  const queries = [
    `${target} company overview employee count year founded`,
    `${target} funding raised crunchbase techcrunch`,
    `${target} technology stack built with`,
    `${target} CEO founder linkedin`
  ];

  console.log(`Starting Firecrawl enrichment pipeline for ${target}...`);

  const searchPromises = queries.map(q => firecrawlSearch(q, 2));
  const results = await Promise.all(searchPromises);

  // Combine markdown extracts from all successful searches
  let combinedContext = '';
  results.forEach((res, index) => {
    if (res && res.data) {
      combinedContext += `\n--- Search Query: ${queries[index]} ---\n`;
      res.data.forEach((item: any) => {
        if (item.markdown) {
          combinedContext += `\nSource: ${item.url}\n${item.markdown.substring(0, 1500)}\n`;
        } else if (item.description) {
          combinedContext += `\nSource: ${item.url}\n${item.description}\n`;
        }
      });
    }
  });

  // Limit context size to avoid token explosion
  combinedContext = combinedContext.substring(0, 12000);

  // Phase 2: Synthesis using Gemini
  const prompt = `
You are an expert business intelligence data extractor.
Your task is to analyze the following web search results for a company and extract structured data.
Target Company Domain/Identifier: ${target}

--- RAW WEB DATA ---
${combinedContext}
--------------------

Extract the following information and output it EXACTLY as a JSON object with these keys:
- "company_name": (string or null) The official name of the company.
- "industry": (string or null) The main industry or category.
- "employee_count": (string or null) E.g. "1-10", "50-200", "1000+".
- "year_founded": (number or null) The year the company was founded.
- "funding_stage": (string or null) E.g. "Seed", "Series A", "Acquired", "Bootstrapped".
- "total_raised": (string or null) E.g. "$10M", "Undisclosed".
- "tech_stack": (array of strings or null) List of technologies they use.
- "ceo_name": (string or null) Name of the CEO or Founder.
- "pain_points": (string or null) The main problems or pain points this company faces based on their industry.
- "ai_solution_angle": (string or null) How a B2B service agency could solve their pain points.
- "recommended_offer": (string or null) A hypothetical service or offer that fits their needs.
- "ai_company_summary": (string or null) A 2-3 sentence overview of what the company does.
- "ai_lead_analysis": (string or null) A brief analysis of this company as a potential sales lead.
- "ai_outreach_strategy": (string or null) A short strategy on how to approach this lead via cold email.
- "ai_personalized_first_line": (string or null) A highly personalized, casual first line for a cold email.

IMPORTANT: Return ONLY the raw JSON object. Do not include markdown formatting like \`\`\`json.
`;

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const response = await ai.models.generateContent({
      model: AI_DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, ''));

    return {
      company_name: parsed.company_name || null,
      industry: parsed.industry || null,
      employee_count: parsed.employee_count || null,
      year_founded: typeof parsed.year_founded === 'number' ? parsed.year_founded : null,
      funding_stage: parsed.funding_stage || null,
      total_raised: parsed.total_raised || null,
      tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack : null,
      ceo_name: parsed.ceo_name || null,
      pain_points: parsed.pain_points || null,
      ai_solution_angle: parsed.ai_solution_angle || null,
      recommended_offer: parsed.recommended_offer || null,
      ai_company_summary: parsed.ai_company_summary || null,
      ai_lead_analysis: parsed.ai_lead_analysis || null,
      ai_outreach_strategy: parsed.ai_outreach_strategy || null,
      ai_personalized_first_line: parsed.ai_personalized_first_line || null,
    };
  } catch (error) {
    console.error('Failed to synthesize enrichment data with Gemini:', error);
    // Return empty schema on failure
    return {
      company_name: null,
      industry: null,
      employee_count: null,
      year_founded: null,
      funding_stage: null,
      total_raised: null,
      tech_stack: null,
      ceo_name: null,
      pain_points: null,
      ai_solution_angle: null,
      recommended_offer: null,
      ai_company_summary: null,
      ai_lead_analysis: null,
      ai_outreach_strategy: null,
      ai_personalized_first_line: null,
    };
  }
}
