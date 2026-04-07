import os
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from utilities.llm_engine import invoke_structured_llm

class ResearchOutput(BaseModel):
    """Output structure for the Research Agent."""
    fact_sheet: str = Field(
        description="A highly structured Markdown Fact-Sheet containing Product Features, Technical Specs, and Target Audience extracted from the content."
    )
    ambiguity_flags: List[str] = Field(
        description="A list of specific ambiguous or unsupported claims found in the source text. Empty if none.",
        default_factory=list
    )

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

    llm_params = {
        "prompt": prompt,
        "schema": ResearchOutput,
        "temperature": 0.0,
        "primary_model": "gemini-3-flash-preview",
        "fallback_model": "gemini-1.5-flash"
    }

    result: ResearchOutput = invoke_structured_llm(**llm_params)

    return {
        "fact_sheet": result.fact_sheet,
        "ambiguity_flags": result.ambiguity_flags
    }
