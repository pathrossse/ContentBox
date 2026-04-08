export interface ClaudeOutput {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generatePosts(insights: any, retryCount = 0): Promise<ClaudeOutput> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const endpoint = "https://api.anthropic.com/v1/messages";
  
  // Model selection with fallback
  const model = retryCount > 0 ? "claude-3-5-haiku-20241022" : "claude-3-5-sonnet-20241022";

  const systemPrompt = "Generate social media content from the provided JSON insights. Return strict JSON with: blog_post, social_thread (array of 3-5 posts), email_teaser. No conversational filler.";
  
  // Validation: Ensure insights is a valid object
  const validatedInsights = insights && typeof insights === 'object' ? insights : { error: "Invalid insights provided" };

  const userMessage = `
    INSIGHTS FROM SOURCE:
    ${JSON.stringify(validatedInsights, null, 2)}
    
    TASK: Generate formatted content. Use platform-specific hashtags for social posts.
  `;

  const requestBody = {
    model: model,
    max_tokens: 4000, // Explicitly safe under 4096
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  console.log(`Claude Request (${model}):`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API Error (${response.status}):`, errorText);

      if (retryCount < 1 && (response.status === 429 || response.status >= 500)) {
        console.warn(`Claude ${model} failed. Retrying with Haiku...`);
        const backoffTime = retryCount === 0 ? 500 : 1500;
        await delay(backoffTime);
        return generatePosts(insights, retryCount + 1);
      }
      throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.content?.[0]?.text;

    if (!resultText) throw new Error("Empty response from Claude");

    // Extract JSON from potential markdown blocks
    let cleanJson = resultText;
    if (cleanJson.includes("```json")) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.includes("```")) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    return JSON.parse(cleanJson) as ClaudeOutput;

  } catch (error: any) {
    if (retryCount < 1) {
       console.warn("Claude Generation Error, attempting Haiku fallback:", error.message);
       await delay(500);
       return generatePosts(insights, retryCount + 1);
    }
    console.error("Claude Pipeline Failed:", error.message);
    throw new Error(`Content generation failed: ${error.message}`);
  }
}
