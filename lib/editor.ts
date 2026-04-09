export interface QCResult {
  approved: boolean;
  feedback: string | null;
  checks: string[];
}

export async function runEditorQC(factSheet: string, draft: string, assetType: string): Promise<QCResult> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const endpoint = "https://api.groq.com/openai/v1/chat/completions";

  const systemInstructions = `You are the Editor-in-Chief. Audit the provided ${assetType} draft against the Fact-Sheet.
  Check for: 
  1. Hallucinations (invented facts/quotes/stats).
  2. Tone Consistency (must be professional but engaging).
  3. Adherence to constraints.

  Output strict JSON:
  - approved: boolean
  - feedback: string (if rejected, explain why specifically)
  - checks: string[] (list of items verified)`;

  const prompt = `
    FACT-SHEET:
    ${factSheet}

    ${assetType.toUpperCase()} DRAFT:
    ${draft}
  `;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Aggressive Timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: prompt }
        ],
        temperature: 0.1, // High precision
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`QC API Error: ${response.status}`);

    const data = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content);
    return result as QCResult;

  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn(`QC Audit failed for ${assetType}:`, error.message);
    return {
      approved: false,
      feedback: "Audit timed out or failed. Manual verification recommended.",
      checks: ["Integrity check bypassed"]
    };
  }
}
