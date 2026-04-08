import { NextRequest, NextResponse } from 'next/server';
import { runDualPipeline } from '@/lib/ai';

export const maxDuration = 30; // Increased for dual-AI pipeline

export async function POST(req: NextRequest) {
  try {
    const start = Date.now();
    const { source } = await req.json();

    if (!source) {
      return NextResponse.json({ detail: "Source URL or text is required" }, { status: 400 });
    }

    // Capture the time before start
    const result = await runDualPipeline(source);
    
    // Performance metrics (simplified as we aren't using a complex timer in the route)
    const elapsed = Date.now() - start;

    return NextResponse.json(result, {
      headers: {
        'X-Response-Time': `${elapsed}ms`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { detail: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
