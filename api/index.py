from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import sys
import os

# Append the root folder so we can import workflow stuff (required for /api serverless)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow import builder
from langgraph.checkpoint.memory import MemorySaver

# Ensure API Key is available
if not os.environ.get("GOOGLE_API_KEY"):
    from dotenv import load_dotenv
    load_dotenv()
    if not os.environ.get("GOOGLE_API_KEY"):
        print("Error: GOOGLE_API_KEY environment variable not set.")
        sys.exit(1)

app = FastAPI(title="ContentBox API")

# Allow CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Checkpointer for state memory
memory = MemorySaver()
graph = builder.compile(checkpointer=memory, interrupt_before=["human_review"])


class AnalyzeRequest(BaseModel):
    source: str

class GenerateRequest(BaseModel):
    thread_id: str
    fact_sheet: str

@app.post("/api/analyze")
async def analyze_content(req: AnalyzeRequest):
    """
    Kicks off Agent 1. Runs until the human_review node interrupt.
    """
    source = req.source.strip()
    if not source:
        raise HTTPException(status_code=400, detail="Empty input.")

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    state_input = {}
    if source.startswith("http://") or source.startswith("https://"):
        state_input["source_url"] = source
    else:
        state_input["raw_text"] = source

    try:
        # Run graph until it pauses
        for event in graph.stream(state_input, config):
            pass
            
        snapshot = graph.get_state(config)
        state = snapshot.values
        
        if "error" in state and state["error"]:
            raise HTTPException(status_code=500, detail=state["error"])
            
        return {
            "thread_id": thread_id,
            "fact_sheet": state.get("fact_sheet", ""),
            "ambiguity_flags": state.get("ambiguity_flags", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate_content(req: GenerateRequest):
    """
    Resumes graph after receiving the manually edited fact_sheet from the frontend.
    """
    config = {"configurable": {"thread_id": req.thread_id}}
    
    # Check if thread exists
    snapshot = graph.get_state(config)
    if not snapshot.next:
        raise HTTPException(status_code=400, detail="Invalid thread_id or pipeline already finished.")
        
    try:
        # Inject the edited state into the graph just like CLI
        graph.update_state(config, {"fact_sheet": req.fact_sheet, "is_verified": True}, as_node="human_review")
        
        # Resume the generator
        for event in graph.stream(None, config):
            pass
            
        final_state = graph.get_state(config).values
        
        return {
            "blog_post": final_state.get("blog_post", ""),
            "social_thread": final_state.get("social_thread", ""),
            "email_teaser": final_state.get("email_teaser", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("\nStarting Backend API on http://127.0.0.1:8000")
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
