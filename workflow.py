from utilities.scraper import scrape_url
from agents.research_agent import analyze_content
from agents.creative_agent import generate_content

from typing import TypedDict, Annotated, List, Optional
from langgraph.graph import StateGraph, START, END

class ContentFactoryState(TypedDict):
    """
    State schema for the Autonomous Content Factory pipeline.
    """
    source_url: Optional[str]
    raw_text: Optional[str]
    extracted_content: Optional[str]
    
    fact_sheet: Optional[str]
    ambiguity_flags: Optional[List[str]]
    
    is_verified: bool
    
    blog_post: Optional[str]
    social_thread: Optional[str]
    email_teaser: Optional[str]
    
    error: Optional[str]

def input_node(state: ContentFactoryState):
    """Extracts text from URL if provided, otherwise uses raw_text."""
    if state.get("source_url"):
        content = scrape_url(state["source_url"])
        if not content:
            return {"error": f"Failed to scrape URL: {state['source_url']}"}
        return {"extracted_content": content}
    elif state.get("raw_text"):
        return {"extracted_content": state["raw_text"]}
    else:
        return {"error": "Neither source_url nor raw_text provided."}

def research_agent_node(state: ContentFactoryState):
    """Calls Agent 1 to analyze content and produce a Fact-Sheet."""
    if state.get("error") or not state.get("extracted_content"):
        return state

    result = analyze_content(state["extracted_content"])
    return {
        "fact_sheet": result["fact_sheet"],
        "ambiguity_flags": result["ambiguity_flags"],
        "is_verified": False # Reset verification state
    }

def human_review_node(state: ContentFactoryState):
    """
    This is an empty node that serves as an interruption point.
    LangGraph will pause execution BEFORE this node (or AFTER the previous).
    When execution resumes, if the user updated the state (fact_sheet), it uses the updated state.
    """
    pass

def creative_agent_node(state: ContentFactoryState):
    """Calls Agent 2 to generate final multi-channel content using the verified Fact-Sheet."""
    if state.get("error") or not state.get("fact_sheet"):
        return state
        
    result = generate_content(state["fact_sheet"])
    return {
        "blog_post": result["blog_post"],
        "social_thread": result["social_thread"],
        "email_teaser": result["email_teaser"]
    }

def should_continue(state: ContentFactoryState):
    if state.get("error"):
        return "end"
    return "continue"

# Graph Construction
builder = StateGraph(ContentFactoryState)

# Add nodes
builder.add_node("process_input", input_node)
builder.add_node("research", research_agent_node)
builder.add_node("human_review", human_review_node)
builder.add_node("creative", creative_agent_node)

# Add edges
builder.add_edge(START, "process_input")

builder.add_conditional_edges(
    "process_input",
    should_continue,
    {"continue": "research", "end": END}
)

builder.add_edge("research", "human_review")
builder.add_edge("human_review", "creative")
builder.add_edge("creative", END)

# Compile graph with human-in-the-loop interrupt
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()
# We interrupt *before* the human_review node so the user has a chance to update state
graph = builder.compile(checkpointer=memory, interrupt_before=["human_review"])
