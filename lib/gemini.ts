export interface GeminiInsights {
  summary: string;
  keyPoints: string[];
  tone: string;
  targetAudience: string;
  mainTopic: string;
}

export async function extractInsights(rawText: string): Promise<GeminiInsights> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
    Extract and return strict JSON only with fields: summary, keyPoints (array of strings), tone, targetAudience, mainTopic.
    
    SOURCE CONTENT:
    ${rawText}
  `;

  const requestBody = {
    contents: [{ 
      role: 'user',
      parts: [{ text: prompt }] 
    }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  console.log("Gemini Request Body:", JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error (${response.status}):`, errorText);
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) throw new Error("Empty response from Gemini");

    return JSON.parse(resultText) as GeminiInsights;

  } catch (error: any) {
    console.warn("Gemini Extraction Failed, using Regex Fallback:", error.message);
    
    // REGEX FALLBACK: Never crash the pipeline
    const summary = rawText.slice(0, 200) + "...";
    const mainTopicMatch = rawText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/);
    
    return {
      summary: summary,
      keyPoints: ["Key points extraction failed - using fallback"],
      tone: "neutral (fallback)",
      targetAudience: "general (fallback)",
      mainTopic: mainTopicMatch ? mainTopicMatch[0] : "extracted content"
    };
  }
}
