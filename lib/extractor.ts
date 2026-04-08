export interface ExtractorInsights {
  summary: string;
  keyPoints: string[];
  tone: string;
  targetAudience: string;
  mainTopic: string;
}

export async function extractInsights(rawText: string): Promise<ExtractorInsights> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const systemPrompt = "Extract and return insights from the provided text. You must return strict JSON only. Fields: summary, keyPoints (array of strings), tone, targetAudience, mainTopic.";
  
  const userPrompt = `SOURCE CONTENT:\n${rawText}`;

  const requestBody = {
    model: "llama-3.1-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" }
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content;
    
    if (!resultText) throw new Error("Empty response from Groq Extractor");

    return JSON.parse(resultText) as ExtractorInsights;

  } catch (error: any) {
    console.warn("Groq Extraction Failed, using Regex Fallback:", error.message);
    
    // REGEX FALLBACK
    const summary = rawText.slice(0, 200) + "...";
    const mainTopicMatch = rawText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
    
    return {
      summary: summary,
      keyPoints: ["Extraction failed - using baseline metadata"],
      tone: "neutral (fallback)",
      targetAudience: "general (fallback)",
      mainTopic: mainTopicMatch ? mainTopicMatch[0] : "content"
    };
  }
}
