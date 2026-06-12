import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/utils/supabase/admin';
import { firecrawlSearch } from '@/lib/enrichment/firecrawl';
import { GoogleGenAI } from '@google/genai';
import { AI_DEFAULT_MODEL } from '@/lib/ai/efficiency';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Ensure user is admin
  const { authorized } = await requireAdmin();
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    // Get the Gemini API key from the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('gemini_api_key')
      .eq('id', user.id)
      .single();

    if (!profile?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 400 });
    }

    console.log(`Starting Firecrawl search for: "${query}" (Limit: ${limit})`);
    
    // 1. Search Firecrawl
    const searchResult = await firecrawlSearch(query, limit);
    if (!searchResult || !searchResult.data || searchResult.data.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No results found' });
    }

    // Prepare text for Gemini extraction
    const rawResults = searchResult.data.map(item => ({
      title: item.title,
      url: item.url,
      description: item.description,
      // Limit markdown size to avoid token overflow
      markdown: item.markdown ? item.markdown.substring(0, 800) : ''
    }));

    // 2. Synthesize using Gemini
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

    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key });
    const response = await ai.models.generateContent({
      model: AI_DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const responseText = response.text || '[]';
    const parsedResults = JSON.parse(responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, ''));

    if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
      return NextResponse.json({ error: 'Failed to extract data from search results' }, { status: 500 });
    }

    // 3. Save to database
    const rowsToInsert = parsedResults.map((item: any) => ({
      search_query: query,
      company_name: item.company_name || 'Unknown Company',
      website: item.website || null,
      description: item.description || null,
      contact_name: item.contact_name || null,
      contact_email: item.contact_email || null,
      status: 'pending'
    }));

    const { error: insertError } = await supabase
      .from('admin_scraping_queue')
      .insert(rowsToInsert);

    if (insertError) {
      console.error('Failed to insert scraped leads:', insertError);
      return NextResponse.json({ error: 'Failed to save leads to staging queue' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rowsToInsert.length });
  } catch (error: any) {
    console.error('Scraping API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
