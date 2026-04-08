import { scrapeUrl } from './scraper';
import { extractInsights } from './extractor';
import { generateContent } from './generator';

export interface ExtractionResponse {
  fact_sheet: string;
  ambiguity_flags: string[];
}

export interface GenerationResponse {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
}

// PHASE 1: Scrape & Extract Insights
export async function runExtractionPipeline(url: string): Promise<ExtractionResponse> {
  console.time("extraction-total");

  // 1. SCRAPE
  console.time("scrape");
  const rawText = await scrapeUrl(url);
  console.timeEnd("scrape");

  // 2. GROQ EXTRACTION
  console.time("groq-extract");
  const insights = await extractInsights(rawText);
  console.timeEnd("groq-extract");

  console.timeEnd("extraction-total");

  return {
    fact_sheet: insights.summary + "\n\n### Key Facts\n" + insights.keyPoints.map(p => `- ${p}`).join("\n"),
    ambiguity_flags: [
      `Tone: ${insights.tone}`,
      `Target: ${insights.targetAudience}`,
      `Topic: ${insights.mainTopic}`
    ]
  };
}

// PHASE 2: Final Content Generation (Human-Reviewed)
export async function runGenerationPipeline(factSheet: string): Promise<GenerationResponse> {
  console.time("generation-total");

  // We wrap the factSheet in a minimal insights structure for the generator
  const mockedInsights = {
    summary: factSheet,
    keyPoints: [],
    tone: "professional (reviewed)",
    targetAudience: "general (reviewed)",
    mainTopic: "reviewed source"
  };

  const content = await generateContent(mockedInsights);
  console.timeEnd("generation-total");

  return {
    blog_post: content.blog_post,
    social_thread: content.social_thread,
    email_teaser: content.email_teaser
  };
}
