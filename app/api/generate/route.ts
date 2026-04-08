import { NextRequest, NextResponse } from 'next/server';
import { runGenerationPipeline } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const start = Date.now();
    const { fact_sheet } = await req.json();

    if (!fact_sheet) {
      return NextResponse.json({ detail: "Fact sheet is required for generation" }, { status: 400 });
    }

    const result = await runGenerationPipeline(fact_sheet);
    
    const elapsed = Date.now() - start;

    return NextResponse.json(result, {
      headers: {
        'X-Response-Time': `${elapsed}ms`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error('Generation Error:', error);
    return NextResponse.json(
      { detail: error.message || "Content generation failed" },
      { status: 500 }
    );
  }
}
