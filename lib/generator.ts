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
  const model = retryCount > 0 ? "llama-3.1-8b-instant" : "llama-3.1-70b-versatile";

  const systemInstructions = "You are a master social media strategist. Generate formatted, high-quality content from the provided JSON insights. Return strict JSON with fields: blog_post (Markdown), social_thread (array of 3 posts), email_teaser (Markdown).";
  
  const prompt = `
    INSIGHTS DATA:
    ${JSON.stringify(insights, null, 2)}
    
    TASK: Generate formatted content. Use platform-specific hashtags for social posts. Ensure the output is valid JSON.
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
