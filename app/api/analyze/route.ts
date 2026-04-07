import { NextRequest, NextResponse } from 'next/server';
import { scrapeUrl } from '@/lib/scraper';
import { runAIService } from '@/lib/ai';

export const maxDuration = 10; // Adjusted for Vercel Hobby Tier limits

export async function POST(req: NextRequest) {
  try {
    const { source } = await req.json();

    if (!source) {
      return NextResponse.json({ detail: "Source URL or text is required" }, { status: 400 });
    }

    // 1. Scrape content
    const scrapedContent = await scrapeUrl(source);

    // 2. Process with AI
    const aiResult = await runAIService(scrapedContent);

    // 3. Return combined payload
    return NextResponse.json({
      thread_id: `next_${Date.now()}`,
      fact_sheet: aiResult.fact_sheet,
      ambiguity_flags: aiResult.ambiguity_flags,
      // Porting the UI's expectation of receiving pre-generated content
      blog_post: aiResult.blog_post,
      social_thread: aiResult.social_thread,
      email_teaser: aiResult.email_teaser
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { detail: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
