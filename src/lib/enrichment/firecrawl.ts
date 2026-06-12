import FirecrawlApp, { ScrapeResponse, SearchResponse, MapResponse } from '@mendable/firecrawl-js';

// Initialize the FirecrawlApp with the API key from the environment
export const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
});

/**
 * Perform a web search using Firecrawl
 */
export async function firecrawlSearch(query: string, limit: number = 3): Promise<SearchResponse | null> {
  try {
    const response: any = await firecrawl.search(query, {
      pageOptions: {
        onlyMainContent: true,
      },
      searchOptions: {
        limit,
      },
    });

    if (response.success === false) {
      console.error(`Firecrawl search failed: ${response.error}`);
      return null;
    }
    
    // Normalize response if it comes back as { web: [...] }
    const data = response.data || response.web;
    if (!data) {
      console.error('Firecrawl search returned unhandled response format:', response);
      return null;
    }

    return { success: true, data } as SearchResponse;
  } catch (error) {
    console.error('Error performing Firecrawl search:', error);
    return null;
  }
}

/**
 * Scrape a specific URL using Firecrawl
 */
export async function firecrawlScrape(url: string): Promise<ScrapeResponse | null> {
  try {
    const response = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    }) as ScrapeResponse;

    if (!response.success) {
      console.error(`Firecrawl scrape failed: ${response.error}`);
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`Error performing Firecrawl scrape on ${url}:`, error);
    return null;
  }
}

/**
 * Map a domain to discover its structure and subpages
 */
export async function firecrawlMap(url: string): Promise<MapResponse | null> {
  try {
    const response = await firecrawl.mapUrl(url);

    if (!response.success) {
      console.error(`Firecrawl map failed: ${response.error}`);
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`Error performing Firecrawl map on ${url}:`, error);
    return null;
  }
}
