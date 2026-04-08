export interface GeneratorOutput {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateContent(insights: any, retryCount = 0): Promise<GeneratorOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  // Model selection with fallback logic
  const model = retryCount > 0 ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";

  const systemInstructions = `You are an Expert Content Marketer with a persuasive and engaging tone. Generate formatted, high-quality content from the provided JSON insights. 
  Output strict JSON with these fields:
  - blog_post: A comprehensive Markdown blog post.
  - social_thread: An array of 3 strings. Angle 1: The Problem. Angle 2: The Solution. Angle 3: The Result/Benefit.
  - email_teaser: A persuasive email (150-200 words). Must include a catchy Subject Line, a personalized hook, 3 bullet points of value, and a strong Call to Action.`;
  
  const prompt = `
    INSIGHTS DATA:
    ${JSON.stringify(insights, null, 2)}
    
    TASK: Generate formatted content. Use platform-specific hashtags for social posts. 
    IMPORTANT: 
    - Email teaser MUST be between 150-200 words.
    - social_thread MUST be an array of simple strings, NOT objects.
    - Tone must be persuasive, engaging, and authoritative.
  `;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      if (retryCount < 1 && response.status === 429) {
        console.warn(`Groq 70b Rate Limited (429). Retrying with 8b...`);
        await delay(500);
        return generateContent(insights, retryCount + 1);
      }
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    
    if (!resultText) throw new Error("Empty response from Groq Generator");

    return JSON.parse(resultText) as GeneratorOutput;

  } catch (error: any) {
    if (retryCount < 1) {
       console.warn("Groq Generation Error, attempting fallback:", error.message);
       await delay(500);
       return generateContent(insights, retryCount + 1);
    }
    console.error("Groq Generation Service failed:", error.message);
    throw new Error(`Generation failed: ${error.message}`);
  }
}
