import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export async function runAIService(content: string) {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.3,
  });

  const prompt = `
    You are the "Master AI Strategist". 
    Analyze the following source material and generate marketing assets.
    
    SOURCE MATERIAL:
    ${content}
    
    TASK:
    1. Create a "fact_sheet" in Markdown.
    2. Identify "ambiguity_flags" (list of vague claims).
    3. Draft a "blog_post" (500 words).
    4. Draft a "social_thread" (5 posts).
    5. Draft an "email_teaser" (1 paragraph).

    RESPONSE FORMAT:
    You must return a valid JSON object with the following keys:
    "fact_sheet", "ambiguity_flags", "blog_post", "social_thread", "email_teaser".
    Ensure the JSON is strictly valid and contains no extra text.
  `;

  const res = await model.invoke(prompt);
  
  // Clean potential Markdown JSON blocks from response
  let cleanContent = res.content.toString();
  if (cleanContent.includes("```json")) {
    cleanContent = cleanContent.split("```json")[1].split("```")[0].trim();
  } else if (cleanContent.includes("```")) {
    cleanContent = cleanContent.split("```")[1].split("```")[0].trim();
  }

  return JSON.parse(cleanContent);
}
