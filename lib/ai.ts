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
  status?: string;
  word_counts: {
    blog: number;
    social: number;
  };
}

// PHASE 1: Scrape & Deep-Mining Extraction
export async function runExtractionPipeline(url: string): Promise<ExtractionResponse> {
  console.time("extraction-total");

  const rawText = await scrapeUrl(url);
  const insights = await extractInsights(rawText);

  console.timeEnd("extraction-total");

  // Format a dense, structured Fact-Sheet
  let factSheetMd = `${insights.summary}\n\n`;
  
  const sections = [
    { label: "Technical Specs", data: insights.keyFacts.technical_specs },
    { label: "Direct Quotes", data: insights.keyFacts.direct_quotes },
    { label: "Data & Statistics", data: insights.keyFacts.statistics },
    { label: "Stakeholder Perspectives", data: insights.keyFacts.stakeholder_perspectives },
    { label: "Counter Arguments", data: insights.keyFacts.counter_arguments },
  ];

  sections.forEach(sec => {
    if (sec.data && sec.data.length > 0) {
      factSheetMd += `### ${sec.label}\n${sec.data.map(p => `- ${p}`).join('\n')}\n\n`;
    }
  });

  return {
    fact_sheet: factSheetMd.trim(),
    ambiguity_flags: [
      `Source Depth: ${insights.summary.length > 100 ? 'High' : 'Low'}`,
      `Tone Style: ${insights.metadata.tone}`,
      `Audience Fit: ${insights.metadata.targetAudience}`
    ]
  };
}

// PHASE 2: High-Authority Generation
export async function runGenerationPipeline(factSheet: string): Promise<GenerationResponse> {
  console.time("generation-total");

  // We pass the entire factSheet string as the source of truth
  const content = await generateContent({ background: factSheet });
  
  console.timeEnd("generation-total");

  return {
    blog_post: content.blog_post,
    social_thread: content.social_thread,
    email_teaser: content.email_teaser,
    status: content.status,
    word_counts: {
      blog: content.blog_post.split(/\s+/).length,
      social: content.social_thread.length
    }
  };
}
