export interface GeneratorOutput {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
  status?: "complete" | "incomplete";
  qc_verified?: boolean;
  qc_feedback?: string;
}

export async function generateContent(insights: any, retryCount = 0, correctionNotes?: string): Promise<GeneratorOutput> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const model = retryCount > 0 ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";

  // Sequential chunked generation to avoid bursting Groq's instantaneous 6000 TPM limit
  let blogVal: any = "Generation failed";
  let socialVal: any = ["Generation failed"];
  let emailVal: any = "Generation failed";

  try {
    const b = await generateChunk(endpoint, GROQ_API_KEY, model, 'blog', insights, correctionNotes, retryCount);
    if (b) blogVal = b;
  } catch (e) {
    console.warn("Blog generation chunk failed.");
  }

  try {
    const s = await generateChunk(endpoint, GROQ_API_KEY, model, 'social', insights, correctionNotes, retryCount);
    if (s && Array.isArray(s)) socialVal = s;
    else if (s) socialVal = [String(s)];
  } catch (e) {
    console.warn("Social generation chunk failed.");
  }

  try {
    const em = await generateChunk(endpoint, GROQ_API_KEY, model, 'email', insights, correctionNotes, retryCount);
    if (em) emailVal = String(em);
  } catch (e) {
    console.warn("Email generation chunk failed.");
  }

  const isComplete = blogVal !== "Generation failed" && socialVal[0] !== "Generation failed" && emailVal !== "Generation failed";

  return {
    blog_post: String(blogVal),
    social_thread: Array.isArray(socialVal) ? socialVal : [String(socialVal)],
    email_teaser: String(emailVal),
    status: isComplete ? "complete" : "incomplete"
  };
}

async function generateChunk(endpoint: string, apiKey: string | undefined, model: string, type: 'blog' | 'social' | 'email', insights: any, correctionNotes?: string, retryCount = 0): Promise<any> {
  const configs = {
    blog: { 
      max_tokens: 2000, 
      extract: (r: any) => r.blog_post,
      prompt: `Output strict JSON with ONE field:
      - blog_post: A deep, long-form SEO blog post in Markdown format. IMPORTANT: Use ONLY Markdown (##, ###, etc.) and NO HTML tags.`
    },
    social: { 
      max_tokens: 1500, 
      extract: (r: any) => r.social_thread,
      prompt: `Output strict JSON with ONE field:
      - social_thread: An array of 5-10 virality-focused tweets. Angle 1: Hook/Problem. Middle: Deep Value. End: Result/Call-to-Action. Each string MUST be under 200 characters.`
    },
    email: { 
      max_tokens: 1500, 
      extract: (r: any) => r.email_teaser,
      prompt: `Output strict JSON with ONE field:
      - email_teaser: A CTR-focused teaser (50-150 words). Format: 1 sentence hook, followed by 3 bullet points of value, then a CTA. Include a "subject" field inside this object or as part of the text.`
    }
  };

  const config = configs[type];

  const systemInstructions = `You are an Expert Content Marketer with a persuasive and engaging tone. Generate formatted, high-quality content from the provided JSON insights. 
  ${correctionNotes ? `CRITICAL CORRECTIONS TO IMPLEMENT: ${correctionNotes}` : ""}
  STRICT RULE: Strictly follow the user-edited facts provided below. Ignore the initial scraped data if it contradicts this updated sheet. The provided insights are your SOLE source of truth.

  ${config.prompt}`;
  
  const prompt = `
    DENSE INSIGHTS:
    ${JSON.stringify(insights, null, 2)}
    
    TASK: Generate high-authority ${type} content based solely on the insights above.
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s Safety Cutoff

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: config.max_tokens, 
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (retryCount < 1 && (response.status === 429 || response.status === 503)) {
        console.warn(`Groq limit hit for ${type}. Retrying with 8b...`);
        return generateChunk(endpoint, apiKey, "llama-3.1-8b-instant", type, insights, correctionNotes, retryCount + 1);
      }
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    
    if (!resultText) throw new Error("Empty response from Groq Generator");

    const parsed = JSON.parse(resultText);
    return config.extract(parsed);

  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.warn(`Generation timed out at 8s for ${type}.`);
      throw new Error("Timeout");
    }

    if (retryCount < 1) {
       console.warn(`Generation Error for ${type}, attempting 8b fallback:`, error.message);
       return generateChunk(endpoint, apiKey, "llama-3.1-8b-instant", type, insights, correctionNotes, retryCount + 1);
    }
    throw error;
  }
}
