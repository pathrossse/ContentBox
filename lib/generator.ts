export interface GeneratorOutput {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
  status?: "complete" | "incomplete";
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateContent(insights: any, retryCount = 0): Promise<GeneratorOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const model = retryCount > 0 ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";

  const systemInstructions = `You are an Expert Content Marketer with a persuasive and engaging tone. Generate formatted, high-quality content from the provided JSON insights. 
  STRICT RULE: Strictly follow the user-edited facts provided below. Ignore the initial scraped data if it contradicts this updated sheet. The provided insights are your SOLE source of truth.

  Output strict JSON with these fields:
  - blog_post: A deep, long-form SEO blog post in Markdown format. IMPORTANT: Use ONLY Markdown (##, ###, etc.) and NO HTML tags.
  - social_thread: An array of 5-10 virality-focused tweets. Angle 1: Hook/Problem. Middle: Deep Value. End: Result/Call-to-Action.
  - email_teaser: A CTR-focused teaser (50-150 words). Format: 1 sentence hook, followed by 3 bullet points of value, then a CTA. Include a "subject" field inside this object or as part of the text.
  - status: "complete"`;
  
  const prompt = `
    DENSE INSIGHTS:
    ${JSON.stringify(insights, null, 2)}
    
    TASK: Generate high-authority content. 
    CONSTRAINTS: 
    - Blog: Strictly Markdown, No HTML tags. Proper professional language.
    - Social: 5-10 strings, each string MUST be under 200 characters. 
    - Email: 50-150 words total. Subject line MUST be under 40 words. Use 1 hook sentence + 3 bullets.
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Safety Cutoff

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
        max_tokens: 6000, 
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (retryCount < 1 && (response.status === 429 || response.status === 503)) {
        console.warn(`Groq limit hit. Retrying with 8b...`);
        return generateContent(insights, retryCount + 1);
      }
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    
    if (!resultText) throw new Error("Empty response from Groq Generator");

    return { ...JSON.parse(resultText), status: "complete" } as GeneratorOutput;

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.warn("Generation timed out at 8s. Returning safety partial.");
      return {
        blog_post: "Content generation exceeded 8s timeout. Please try with shorter source content.",
        social_thread: ["Timeout - partial generation unavailable"],
        email_teaser: "Timeout - partial generation unavailable",
        status: "incomplete"
      };
    }

    if (retryCount < 1) {
       console.warn("Generation Error, attempting 8b fallback:", error.message);
       return generateContent(insights, retryCount + 1);
    }
    throw new Error(`Generation failed: ${error.message}`);
  }
}
