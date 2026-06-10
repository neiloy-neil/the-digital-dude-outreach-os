import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenAI } from '@google/genai';
import * as cheerio from 'cheerio';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    // Parse the body if it exists
    let offers = [];
    let companyContext = null;
    try {
      const body = await request.json();
      offers = body.offers || [];
      companyContext = body.companyContext || null;
    } catch (e) {
      // Body might be empty, that's okay
    }
    
    // Fetch lead and profile
    const [{ data: lead, error: leadError }, { data: profile }] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase.from('profiles').select('gemini_api_key').eq('id', user.id).single(),
    ]);

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!profile?.gemini_api_key) {
      return NextResponse.json({ error: 'Gemini API key is not configured in settings.' }, { status: 400 });
    }

    let targetUrl = lead.website || lead.company_website;
    
    // If no website is explicitly set, try to derive from email domain
    if (!targetUrl && lead.email) {
      const domain = lead.email.split('@')[1];
      const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
      if (domain && !commonProviders.includes(domain.toLowerCase())) {
        targetUrl = `https://${domain}`;
      }
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'No website URL available for this lead to research.' }, { status: 400 });
    }

    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`;
    }

    // 1. Fetch website HTML
    let websiteText = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Remove unwanted elements
        $('script, style, noscript, nav, footer, iframe, img, svg').remove();
        
        // Extract text and clean up whitespace
        websiteText = $('body').text().replace(/\s+/g, ' ').trim();
      }
    } catch (error) {
      console.warn(`Could not fetch website ${targetUrl}:`, error);
      return NextResponse.json({ error: 'Failed to access the website for scraping. It may be blocking automated requests.' }, { status: 400 });
    }

    if (!websiteText || websiteText.length < 50) {
      return NextResponse.json({ error: 'Not enough readable text found on the website.' }, { status: 400 });
    }

    // Truncate to save tokens (approx 3000 chars is enough for summary)
    websiteText = websiteText.slice(0, 4000);

    const offersString = offers.length > 0 ? offers.map((o: any) => \`- \${o.name}: \${o.description || 'No description'}\`).join('\\n') : 'No specific offers provided. Suggest a general B2B service.';
    const ourCompanyString = companyContext?.company_name ? \`Our Company: \${companyContext.company_name}\\nWhat we do: \${companyContext.company_description || 'B2B Services'}\` : 'Our Company: A B2B Service Agency';

    // 2. Ask Gemini for summary and pain points
    const prompt = \`
You are an expert sales researcher. I am providing you with the text scraped from a company's website.
Company Name: \${lead.company_name || lead.company || 'Unknown'}

\${ourCompanyString}

Our Available Offers/Services:
\${offersString}

Website Content:
"""
\${websiteText}
"""

Based on this content, please extract the following in strictly valid JSON format:
1. "company_summary": A clear, concise 1-2 sentence description of exactly what this company does.
2. "pain_points": Identify 2-3 likely pain points or challenges this company faces that we could help solve. Write this as a short, punchy sentence or bullet points.
3. "solution_angle": Write 1-2 sentences explaining exactly how our company and services can solve their specific pain points.
4. "recommended_offer": The exact name of the offer/service from our list that best fits their needs. If none fit perfectly, invent a relevant service name.

Return ONLY a JSON object with these keys, nothing else. No markdown wrappers.
{
  "company_summary": "...",
  "pain_points": "...",
  "solution_angle": "...",
  "recommended_offer": "..."
}
\`;

    const ai = new GoogleGenAI({ apiKey: profile.gemini_api_key });
    let aiResponse;
    let retries = 3;
    let delay = 1000;
    while (retries > 0) {
      try {
        aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        break;
      } catch (err: any) {
        if (err.status === 503 || err.status === 429 || err.message?.includes('503')) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw err;
        }
      }
    }

    const responseText = aiResponse?.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText.trim().replace(/^```json\s*/i, '').replace(/```$/i, ''));
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", responseText);
      return NextResponse.json({ error: 'AI returned invalid formatting.' }, { status: 500 });
    }

    const { company_summary, pain_points, solution_angle, recommended_offer } = parsedResult;

    if (!company_summary && !pain_points) {
      return NextResponse.json({ error: 'AI failed to extract useful information.' }, { status: 500 });
    }

    // 3. Update the lead in DB
    const updateData: any = {};
    if (company_summary) updateData.ai_company_summary = company_summary;
    if (pain_points) updateData.pain_points = pain_points;
    if (solution_angle) {
      updateData.ai_solution_angle = solution_angle;
      updateData.solution = solution_angle;
    }
    if (recommended_offer) updateData.recommended_offer = recommended_offer;

    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      result: {
        company_summary,
        pain_points,
        solution_angle,
        recommended_offer
      }
    });

  } catch (error: any) {
    console.error('Auto-research error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
