import os
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from typing import Dict, Any
from utilities.llm_engine import invoke_structured_llm

class CreativeOutput(BaseModel):
    """Output structure for the Creative Agent."""
    blog_post: str = Field(description="A 500-word professional blog post based on the Fact-Sheet.")
    social_thread: str = Field(description="A punchy and engaging 5-post social media thread based on the Fact-Sheet.")
    email_teaser: str = Field(description="A 1-paragraph email teaser summarizing the core value proposition.")

    prompt = f"""
    You are the "Creative Voice", a world-class Multi-Channel Copywriter.

    Your task is to take the verified Fact-Sheet and generate accurate, platform-appropriate content across three channels simultaneously.

    CONSTRAINT: No "hallucinations". You must use ONLY the facts provided in the Fact-Sheet. Ensure the core value proposition is central to every piece. No invented features or unsupported claims allowed.

    Output three pieces of content:
    1. A 500-word Blog Post (Professional Tone)
    2. A 5-post Social Media Thread (Punchy and Engaging Tone. Formatting Rule: Use lots of white space. Add a double line break between EVERY single sentence or point so it is highly readable on mobile phones.)
    3. A 1-paragraph Email Teaser (Intriguing Tone)

    Verified Fact-Sheet:
    --------------------
    {fact_sheet}
    --------------------
    """

    llm_params = {
        "prompt": prompt,
        "schema": CreativeOutput,
        "temperature": 0.7,
        "primary_model": "gemini-3-flash-preview",
        "fallback_model": "gemini-1.5-flash"
    }

    result: CreativeOutput = invoke_structured_llm(**llm_params)

    return {
        "blog_post": result.blog_post,
        "social_thread": result.social_thread,
        "email_teaser": result.email_teaser
    }
