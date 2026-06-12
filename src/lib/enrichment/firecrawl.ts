import FirecrawlApp from '@mendable/firecrawl-js';

// Initialize the FirecrawlApp with the API key from the environment
export const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
});

/**
 * Perform a web search using Firecrawl
 */
export async function firecrawlSearch(query: string, limit: number = 3): Promise<any | null> {
  try {
    const response: any = await firecrawl.search(query, {
      limit,
    } as any);

    if (response.success === false) {
      console.error(`Firecrawl search failed: ${response.error}`);
      return null;
    }
    
    // Safely extract data without triggering the getter error
    let data;
    if (response && typeof response === 'object') {
      if ('web' in response) {
        data = response.web;
      } else if ('data' in response) {
        data = response.data;
      }
    }
    
    if (!data) {
      console.error('Firecrawl search returned unhandled response format:', response);
      return null;
    }

    return { success: true, data } as any;
  } catch (error) {
    console.error('Error performing Firecrawl search:', error);
    return null;
  }
}

/**
 * Scrape a specific URL using Firecrawl
 */
export async function firecrawlScrape(url: string): Promise<any | null> {
  try {
    const response = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    }) as any;

    if (response.success === false) {
      console.error(`Firecrawl scrape failed: ${response.error}`);
      return null;
    }
    
    // In some SDK versions, the data is returned directly
    return response;
  } catch (error) {
    console.error(`Error performing Firecrawl scrape on ${url}:`, error);
    return null;
  }
}

/**
 * Map a domain to discover its structure and subpages
 */
export async function firecrawlMap(url: string): Promise<any | null> {
  try {
    const response = await firecrawl.mapUrl(url) as any;

    if (response.success === false) {
      console.error(`Firecrawl map failed: ${response.error}`);
      return null;
    }
    
    return response;
  } catch (error) {
    console.error(`Error performing Firecrawl map on ${url}:`, error);
    return null;
  }
}
