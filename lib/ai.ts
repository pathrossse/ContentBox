export async function runAIService(content: string): Promise<any> {
  const prompt = `
    Analyze the following source material and generate marketing assets.
    Return a valid JSON object with the following keys:
    "fact_sheet" (Markdown), "ambiguity_flags" (list), "blog_post" (Markdown), "social_thread" (list of strings), "email_teaser" (Markdown).
    
    SOURCE:
    ${content}
    
    CRITICAL: Return ONLY raw JSON. No conversational text. No markdown blocks.
  `;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.GOOGLE_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI request failed: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const textContent = data.content?.[0]?.text ?? '';
  
  try {
    // Attempt to parse JSON directly or extract it from blocks
    let jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(textContent);
  } catch (e) {
    console.error('JSON Parse Error:', textContent);
    throw new Error('AI failed to produce a valid JSON report. Please try again.');
  }
}
