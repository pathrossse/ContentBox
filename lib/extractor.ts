export interface ExtractorInsights {
  summary: string;
  keyFacts: {
    technical_specs: string[];
    direct_quotes: string[];
    statistics: string[];
    stakeholder_perspectives: string[];
    counter_arguments: string[];
  };
  metadata: {
    tone: string;
    targetAudience: string;
    mainTopic: string;
  };
}

export async function extractInsights(rawText: string): Promise<ExtractorInsights> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const systemPrompt = `You are a high-density data extractor. Extract 15-20 granular data points from the content. You must return strict JSON only. 
  Fields:
  - summary: 2-3 sentences.
  - keyFacts: { technical_specs: [], direct_quotes: [], statistics: [], stakeholder_perspectives: [], counter_arguments: [] }
  - metadata: { tone, targetAudience, mainTopic }
  Ensure extraction is dense and specific.`;
  
  const userPrompt = `SOURCE CONTENT:\n${rawText}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(8500), // Strict extraction timeout
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
    console.warn("Groq Extraction Failed, using Minimal Fallback:", error.message);
    return {
      summary: "Manual extraction required due to system timeout.",
      keyFacts: {
        technical_specs: ["Detection failed"],
        direct_quotes: [],
        statistics: [],
        stakeholder_perspectives: [],
        counter_arguments: []
      },
      metadata: { tone: "Neutral", targetAudience: "General", mainTopic: "Content Analysis" }
    };
  }
}
