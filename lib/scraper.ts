import * as cheerio from 'cheerio';

export async function scrapeUrl(url: string): Promise<string> {
  // If not a URL, treat as raw text
  if (!url.startsWith('http')) return url.slice(0, 5000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4103.116 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000), // Vercel Hobby-safe timeout
    });

    if (!response.ok) throw new Error(`HTTP fetch failure: ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // Filter out irrelevant noise
    $('script, style, nav, footer, header, iframe, noscript, svg, path').remove();

    // Prioritize semantic content areas
    const content = $('main, article, [role="main"], #content, .content, .post, .entry').text() || $('body').text();

    // Clean extra whitespace and truncate to keep prompt tokens low
    return content
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  } catch (error: any) {
    console.error('System Scraper Error:', error.message);
    throw new Error(`Scraper failed: ${error.message}`);
  }
}
