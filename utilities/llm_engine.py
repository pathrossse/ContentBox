import os
from typing import Type, Any
from tenacity import retry, stop_after_attempt, wait_exponential
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

def invoke_structured_llm(
    prompt: str, 
    schema: Type[BaseModel], 
    primary_model: str = "gemini-3-flash-preview", 
    fallback_model: str = "gemini-1.5-flash", 
    temperature: float = 0.0
) -> Any:
    """
    Invokes the LLM with structured output, implementing exponential backoff retries 
    and a stable model fallback mechanism.
    """
    
    # We define the retryable function locally to preserve the closure 
    # of the api_key and specific model_name being attempted.
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def _attempt_llm(model_name: str):
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            api_key=os.environ.get("GOOGLE_API_KEY", "").strip()
        )
        # Use LangChain's structured output wrapper
        structured_llm = llm.with_structured_output(schema)
        return structured_llm.invoke(prompt)

    try:
        # Phase 1: Try the primary model with 3 retries
        return _attempt_llm(primary_model)
    except Exception as primary_err:
        print(f"CRITICAL: Primary model {primary_model} failed after retries: {str(primary_err)}")
        print(f"ACTION: Falling back to {fallback_model} for stability.")
        
        # Phase 2: Try the stable fallback model with its own 3 retries
        try:
            return _attempt_llm(fallback_model)
        except Exception as fallback_err:
            print(f"FATAL: Both primary and fallback models failed: {str(fallback_err)}")
            raise fallback_err
