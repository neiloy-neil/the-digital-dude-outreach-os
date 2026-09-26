import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/utils/supabase/admin';
import { firecrawlSearch, firecrawlScrape } from '@/lib/enrichment/firecrawl';
import { GoogleGenAI } from '@google/genai';
import { AI_DEFAULT_MODEL } from '@/lib/ai/efficiency';
import { runWithConcurrencyLimit } from '@/lib/concurrency';
import { normalizeWebsiteForDedup } from '@/lib/dedup';

export const maxDuration = 60; // Allow 60s for deep scraping

const ENRICH_CONCURRENCY_LIMIT = 4;

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
    const rawResults = searchResult.data.map((item: any) => ({
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

Instructions:
1. Identify UNIQUE companies. Do NOT create multiple entries for the same company. Combine information if multiple results discuss the same company.
2. Only include actual companies that have their own business website URL. Ignore news articles, Reddit threads, Quora, Instagram, Facebook, and generic directories.
3. For each unique company, extract:
- "company_name": (string) The official name of the company.
- "website": (string) The actual URL of the company's website.
- "description": (string) A 1-2 sentence description of what they do.
- "contact_name": (string or null) Name of the CEO, Founder, or key decision maker if mentioned. Otherwise null.
- "contact_email": (string or null) Any email address explicitly found. Otherwise null.

Return EXACTLY a JSON array of objects. Do not include markdown formatting like \`\`\`json.
`;

    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key });
    const response = await ai.models.generateContent({
      model: AI_DEFAULT_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const responseText = response.text || '[]';
    let parsedResults = [];
    try {
      // Robust JSON extraction: find the first '[' and last ']'
      const match = responseText.match(/\[[\s\S]*\]/);
      const jsonString = match ? match[0] : responseText;
      parsedResults = JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to parse main AI JSON:', responseText);
      return NextResponse.json({ error: 'Failed to extract valid data from search results' }, { status: 500 });
    }

    if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
      return NextResponse.json({ error: 'Failed to extract data from search results' }, { status: 500 });
    }

    // Deduplicate and filter out invalid websites
    const uniqueLeadsMap = new Map();
    const seenWebsites = new Set<string>();
    const invalidDomains = ['instagram.com', 'facebook.com', 'reddit.com', 'quora.com', 'youtube.com', 'tiktok.com', 'linkedin.com', 'ndtv.com', 'timesofindia', 'news', 'hindustantimes', 'threads.net'];

    for (const lead of parsedResults) {
      const url = (lead.website || '').toLowerCase();
      if (!url || invalidDomains.some(domain => url.includes(domain))) {
         continue; // Must have a real company website
      }

      const websiteKey = normalizeWebsiteForDedup(lead.website);
      if (!websiteKey || seenWebsites.has(websiteKey)) {
        continue;
      }

      const key = (lead.company_name || 'Unknown').toLowerCase().trim();
      if (key && !uniqueLeadsMap.has(key)) {
         uniqueLeadsMap.set(key, lead);
         seenWebsites.add(websiteKey);
      }
    }

    let finalLeads = Array.from(uniqueLeadsMap.values());

    // Skip re-enriching/re-inserting companies already in the queue or pool
    // (best-effort app-level check; the DB unique index is the backstop).
    const candidateWebsiteKeys = new Set(finalLeads.map((lead) => normalizeWebsiteForDedup(lead.website)));
    const [{ data: existingQueueRows }, { data: existingPoolRows }] = await Promise.all([
      supabase.from('admin_scraping_queue').select('website').not('website', 'is', null).limit(5000),
      supabase.from('admin_leads_pool').select('website').not('website', 'is', null).limit(5000),
    ]);
    const existingWebsiteKeys = new Set(
      [...(existingQueueRows || []), ...(existingPoolRows || [])]
        .map((row: any) => normalizeWebsiteForDedup(row.website))
        .filter(Boolean)
    );
    finalLeads = finalLeads.filter((lead) => {
      const websiteKey = normalizeWebsiteForDedup(lead.website);
      return websiteKey && candidateWebsiteKeys.has(websiteKey) && !existingWebsiteKeys.has(websiteKey);
    });

    if (finalLeads.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'All matching companies are already in the queue or lead pool.' });
    }

    // 3. Automatically deep-scrape to find emails. Only keep leads where an email is found.
    const leadsWithEmailsRaw = await runWithConcurrencyLimit(finalLeads, ENRICH_CONCURRENCY_LIMIT, async (lead: any) => {
        // If the snippet already had an email, keep it!
        if (lead.contact_email && lead.contact_email.includes('@')) {
          return { ...lead, email_source: 'found' };
        }

        try {
          // Normalize URL
          let urlToScrape = lead.website;
          if (!urlToScrape.startsWith('http')) {
            urlToScrape = 'https://' + urlToScrape;
          }

          console.log(`Deep scraping: ${urlToScrape}`);
          
          // Fire off both requests in parallel to save time
          const [scrapeRes, linkedinRes] = await Promise.all([
            firecrawlScrape(urlToScrape),
            firecrawlSearch(`site:linkedin.com/in "${lead.company_name}" (CEO OR Founder OR Owner OR Director OR "Managing Director")`, 1)
          ]);
          
          const markdownData = scrapeRes?.data?.markdown || (scrapeRes as any)?.markdown;
          let linkedinText = 'No LinkedIn data found.';
          
          // Format LinkedIn data if found
          if (linkedinRes && linkedinRes.data && linkedinRes.data.length > 0) {
            linkedinText = linkedinRes.data.map((item: any) => `Name/Title: ${item.title}\nDescription: ${item.description}`).join('\n\n');
          }
          
          if (scrapeRes && scrapeRes.success !== false && markdownData) {
            const markdownText = markdownData.substring(0, 15000); // Limit context
            const emailPrompt = `
You are a data extractor. Find the best contact email address and the decision maker's name for this company.

CRITICAL INSTRUCTIONS:
1. Identify the CEO, Founder, Owner, or top decision maker from the LinkedIn Data or Website Data.
2. Only return an email you found explicitly written in the LinkedIn data or website content (set "source" to "found"). Do NOT invent or guess an email address from a name and domain pattern.
3. If no email is explicitly present anywhere in the provided data, return {"email": null, "name": null, "source": null} rather than guessing one.

Return EXACTLY a JSON object: {"email": "email@domain.com or null", "name": "Decision Maker Name or null", "source": "found or null"}.
Do not include markdown formatting.

--- COMPANY DOMAIN ---
${urlToScrape}

--- LINKEDIN SEARCH DATA (For finding the CEO/Founder) ---
${linkedinText}

--- WEBSITE CONTENT ---
${markdownText}
`;
            const emailAiRes = await ai.models.generateContent({
              model: AI_DEFAULT_MODEL,
              contents: emailPrompt,
              config: { responseMimeType: 'application/json' },
            });

            const emailResText = emailAiRes.text || '{}';
            let emailParsed: { email: string | null; name: string | null; source: string | null } = { email: null, name: null, source: null };
            try {
              const match = emailResText.match(/\{[\s\S]*\}/);
              const jsonString = match ? match[0] : emailResText;
              emailParsed = JSON.parse(jsonString);
            } catch (e) {
              console.error('Failed to parse email AI JSON:', emailResText);
            }

            if (emailParsed.email) {
              console.log(`Found email for ${urlToScrape}: ${emailParsed.email} (${emailParsed.name || 'No Name'})`);
              lead.contact_email = emailParsed.email;
              lead.contact_name = emailParsed.name || null;
              lead.ai_company_summary = 'Deep enriched with LinkedIn decision-maker data';
              lead.email_source = 'found';
              return lead;
            } else {
              console.log(`No email found on website: ${urlToScrape}`);
            }
          } else {
            console.log(`Scrape failed for ${urlToScrape}:`, scrapeRes?.error || 'No markdown');
          }
        } catch (err) {
          console.error(`Failed to auto-enrich email for ${lead.website}:`, err);
        }
        return null;
    });

    // Filter out nulls (leads without emails) and rejected/failed enrichments
    finalLeads = leadsWithEmailsRaw
      .map((result) => (result.status === 'fulfilled' ? result.value : null))
      .filter((l: any) => l !== null && l.contact_email);

    if (finalLeads.length === 0) {
       return NextResponse.json({ success: true, count: 0, message: '0 unique leads with emails found. Try a broader search.' });
    }

    // 4. Save to database
    const rowsToInsert = finalLeads.map((item: any) => ({
      search_query: query,
      company_name: item.company_name || 'Unknown Company',
      website: item.website || null,
      description: item.description || null,
      contact_name: item.contact_name || null,
      contact_email: item.contact_email || null,
      ai_company_summary: item.ai_company_summary || null,
      email_source: item.email_source || null,
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
