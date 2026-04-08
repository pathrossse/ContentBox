export interface GeneratorOutput {
  blog_post: string;
  social_thread: string[];
  email_teaser: string;
}

export async function generateContent(insights: any): Promise<GeneratorOutput> {
  const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `
    You are a master social media strategist. Generate formatted, high-quality content from the provided insights. 
    Return strict JSON only with fields: blog_post (Markdown), social_thread (array of 3 strings), email_teaser (Markdown).
    
    INSIGHTS DATA:
    ${JSON.stringify(insights, null, 2)}
    
    TASK: Generate formatted content. Use platform-specific hashtags for social posts.
  `;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json"
    }
  };

  console.log("Gemini Pro Generation Request:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000), // Pro may take longer
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini Pro Generator Error (${response.status}):`, errorText);
      throw new Error(`Gemini Pro API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) throw new Error("Empty response from Gemini Pro");

    return JSON.parse(resultText) as GeneratorOutput;

  } catch (error: any) {
    console.error("Gemini Pro Generation failed:", error.message);
    throw new Error(`Generation Service Failed: ${error.message}`);
  }
}
