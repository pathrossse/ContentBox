import os
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from typing import List, Dict, Any

class ResearchOutput(BaseModel):
    """Output structure for the Research Agent."""
    fact_sheet: str = Field(
        description="A highly structured Markdown Fact-Sheet containing Product Features, Technical Specs, and Target Audience extracted from the content."
    )
    ambiguity_flags: List[str] = Field(
        description="A list of specific ambiguous or unsupported claims found in the source text. Empty if none.",
        default_factory=list
    )

def analyze_content(content: str) -> Dict[str, Any]:
    """
    Agent 1 (Analytical Brain): Extracts objective data from the text.
    Uses Gemini 1.5 Pro to process the source and return a structured Fact-Sheet and Ambiguity Flags.
    """
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        temperature=0.0, # Low temperature for objective extraction
        api_key=os.environ.get("GOOGLE_API_KEY", "").strip()
    )
    
    # We use structured output to ensure we get both the markdown and the flags separated.
    structured_llm = llm.with_structured_output(ResearchOutput)

    prompt = f"""
    You are the "Analytical Brain", a highly-skilled Technical Researcher & Auditor.

    Your task is to analyze the following raw source material and extract objective data:
    1. Core Product Features
    2. Technical Specifications
    3. Target Audience

    Output exactly TWO things:
    1. A structured 'fact_sheet' in Markdown format that serves as the single source of truth.
    2. A list of 'ambiguity_flags' highlighting any vague, unclear, or unsupported claims in the source material that could lead to inconsistent content.

    Raw Source Material:
    --------------------
    {content}
    --------------------
    """

    result: ResearchOutput = structured_llm.invoke(prompt)

    return {
        "fact_sheet": result.fact_sheet,
        "ambiguity_flags": result.ambiguity_flags
    }
