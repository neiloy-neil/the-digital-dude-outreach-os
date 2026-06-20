import { firecrawlSearch } from '@/lib/enrichment/firecrawl';
import { GoogleGenAI } from '@google/genai';
import { AI_DEFAULT_MODEL } from '@/lib/ai/efficiency';

async function test() {
  const query = 'marketing agencies in london';
  const limit = 3;

  console.log('1. Testing firecrawlSearch...');
  const searchResult = await firecrawlSearch(query, limit);
  console.log('firecrawlSearch result:', JSON.stringify(searchResult, null, 2));

  if (!searchResult || !searchResult.data || searchResult.data.length === 0) {
    console.log('No results from Firecrawl.');
    return;
  }

  const rawResults = searchResult.data.map((item: any) => ({
    title: item.title,
    url: item.url,
    description: item.description,
    markdown: item.markdown ? item.markdown.substring(0, 800) : ''
  }));

  console.log('2. Extracted raw results:', rawResults);

  const prompt = `
You are an expert lead generation data extractor.
Analyze the following search results from a web search query: "${query}".

--- RAW SEARCH RESULTS ---
${JSON.stringify(rawResults, null, 2)}
--------------------------

For each search result, extract the following fields:
- "company_name": (string or null) The official name of the company.
- "website": (string or null) The URL of the company.
- "description": (string or null) A 1-2 sentence description of what they do.
- "contact_name": (string or null) Name of the CEO, Founder, or key decision maker if mentioned. Otherwise null.
- "contact_email": (string or null) Any email address found. Prioritize founder/CEO emails. If none, look for generic ones (hello@, contact@). Otherwise null.

Return EXACTLY a JSON array of objects. Do not include markdown formatting like \`\`\`json.
`;

  console.log('3. Calling Gemini...');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('No GEMINI_API_KEY found');
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: AI_DEFAULT_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  const responseText = response.text || '[]';
  console.log('Gemini raw text:', responseText);

  try {
    const parsedResults = JSON.parse(responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, ''));
    console.log('Parsed results count:', parsedResults.length);
    console.log(parsedResults);
  } catch (e) {
    console.log('Failed to parse JSON:', e);
  }
}

test();
