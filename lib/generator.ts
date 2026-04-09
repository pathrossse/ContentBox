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

  let blogVal: any = "Generation failed";
  let socialVal: any = ["Generation failed"];
  let emailVal: any = "Generation failed";

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  try {
    const b = await generateChunk(endpoint, GROQ_API_KEY, model, 'blog', insights, retryCount);
    if (b) blogVal = b;
  } catch (e) {
    console.warn("Blog generation chunk failed.");
  }

  await sleep(1000); // Strict 1s gap to dodge burst rate threshold

  try {
    const s = await generateChunk(endpoint, GROQ_API_KEY, model, 'social', insights, retryCount);
    if (s && Array.isArray(s)) socialVal = s;
    else if (s) socialVal = [String(s)];
  } catch (e) {
    console.warn("Social generation chunk failed.");
  }

  await sleep(1000); // Strict 1s gap 

  try {
    const em = await generateChunk(endpoint, GROQ_API_KEY, model, 'email', insights, retryCount);
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

async function generateChunk(endpoint: string, apiKey: string | undefined, model: string, type: 'blog' | 'social' | 'email', insights: any, retryCount = 0): Promise<any> {
  const configs = {
    blog: { 
      max_tokens: 1500, 
      extract: (r: any) => r.blog_post,
      prompt: `Output JSON { "blog_post": "deep dive in Markdown" }`
    },
    social: { 
      max_tokens: 800, 
      extract: (r: any) => r.social_thread,
      prompt: `Output JSON { "social_thread": ["tweet 1", "tweet 2"] } max 5 tweets.`
    },
    email: { 
      max_tokens: 800, 
      extract: (r: any) => r.email_teaser,
      prompt: `Output JSON { "email_teaser": "1 hook, 3 bullets, 1 CTA" }`
    }
  };

  const config = configs[type];
  const systemInstructions = `You are a Content Marketer. Use insights for facts. Ignore external facts. ${config.prompt}`;
  
  const prompt = `INSIGHTS:\n${JSON.stringify(insights)}\n\nGenerate ${type} content strictly matching JSON format.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

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
      if (retryCount < 2 && (response.status === 429 || response.status === 503)) {
        console.warn(`Groq limit for ${type}. Backing off...`);
        const delay = Math.pow(2, retryCount) * 1500; // 1.5s, 3s
        await new Promise(r => setTimeout(r, delay));
        return generateChunk(endpoint, apiKey, "llama-3.1-8b-instant", type, insights, retryCount + 1);
      }
      throw new Error(`Groq Error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    if (!resultText) throw new Error("Empty response");

    return config.extract(JSON.parse(resultText));

  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') throw new Error("Timeout");
    
    if (retryCount < 2) {
       console.warn(`Generation Error for ${type}, retrying:`, error.message);
       const delay = Math.pow(2, retryCount) * 1500;
       await new Promise(r => setTimeout(r, delay));
       return generateChunk(endpoint, apiKey, "llama-3.1-8b-instant", type, insights, retryCount + 1);
    }
    throw error;
  }
}
