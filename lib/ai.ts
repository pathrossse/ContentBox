import { scrapeUrl } from './scraper';
import { extractInsights } from './gemini';
import { generatePosts } from './claude';

// Final return interface for frontend compatibility
export interface PipelineResponse {
  thread_id: string;
  fact_sheet: string;
  ambiguity_flags: string[];
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
  performance?: Record<string, string>;
}

export async function runDualPipeline(url: string, _preferences?: any): Promise<PipelineResponse> {
  console.time("total");

  // 1. SCRAPE
  console.time("scrape");
  const rawText = await scrapeUrl(url);
  console.timeEnd("scrape");

  // 2. GEMINI EXTRACTION
  console.time("gemini-extract");
  const insights = await extractInsights(rawText);
  console.timeEnd("gemini-extract");

  // 3. CLAUDE GENERATION
  console.time("claude-generate");
  const content = await generatePosts(insights);
  console.timeEnd("claude-generate");

  console.timeEnd("total");

  return {
    thread_id: `dual_${Date.now()}`,
    fact_sheet: insights.summary + "\n\n### Key Facts\n" + insights.keyPoints.map(p => `- ${p}`).join("\n"),
    ambiguity_flags: [
      `Tone: ${insights.tone}`,
      `Target: ${insights.targetAudience}`,
      `Topic: ${insights.mainTopic}`
    ],
    blog_post: content.blog_post,
    social_thread: content.social_thread,
    email_teaser: content.email_teaser
  };
}
