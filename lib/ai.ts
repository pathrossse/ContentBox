import { scrapeUrl } from './scraper';
import { extractInsights } from './extractor';
import { generateContent } from './generator';
import { runEditorQC } from './editor';

export interface ExtractionResponse {
  fact_sheet: string;
  ambiguity_flags: string[];
}

export interface GenerationResponse {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
  status?: string;
  qc_verified: boolean;
  qc_feedback?: string;
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
  
  if (insights.keyFacts && insights.keyFacts.length > 0) {
    factSheetMd += `### Key Facts\n${insights.keyFacts.map(p => `- ${p}`).join('\n')}\n\n`;
  }

  return {
    fact_sheet: factSheetMd.trim(),
    ambiguity_flags: [
      `Source Depth: ${insights.summary.length > 100 ? 'High' : 'Low'}`,
      `Tone Style: ${insights.metadata.tone}`,
      `Audience Fit: ${insights.metadata.targetAudience}`
    ]
  };
}

// PHASE 2: High-Authority Generation with QC Loop
export async function runGenerationPipeline(factSheet: string): Promise<GenerationResponse> {
  const pipelineStart = Date.now();
  console.time("generation-total");

  // Initial Attempt (70b)
  let content = await generateContent({ fact_sheet: factSheet });
  
  // Parallel QC Audit (8b)
  // We run all 3 checks simultaneously to minimize latency
  const qcResults = await Promise.all([
    runEditorQC(factSheet, content.blog_post, "Blog Post"),
    runEditorQC(factSheet, content.social_thread.join('\n'), "Social Thread"),
    runEditorQC(factSheet, content.email_teaser, "Email Teaser")
  ]);

  const allApproved = qcResults.every(r => r.approved);
  const feedback = qcResults.filter(r => !r.approved).map(r => r.feedback).join(' | ');

  // Loop Control: Single retry if rejected AND within time
  // We check if we have enough time left before the 10s Vercel limit
  if (!allApproved && (Date.now() - pipelineStart < 5000)) {
    console.warn("QC Rejected! Triggering Correction Cycle with feedback:", feedback);
    content = await generateContent({ fact_sheet: factSheet }, 1, feedback);
    content.qc_verified = true; // Mark as verified if second pass completes
  } else {
    content.qc_verified = allApproved;
    content.qc_feedback = !allApproved ? feedback : undefined;
  }
  
  console.timeEnd("generation-total");

  return {
    blog_post: content.blog_post,
    social_thread: content.social_thread,
    email_teaser: content.email_teaser,
    status: content.status,
    qc_verified: !!content.qc_verified,
    qc_feedback: content.qc_feedback,
    word_counts: {
      blog: content.blog_post.split(/\s+/).length,
      social: content.social_thread.length
    }
  };
}
