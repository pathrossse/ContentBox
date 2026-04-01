import os
import uuid
import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure API Key is available
if not os.environ.get("GOOGLE_API_KEY"):
    print("Error: GOOGLE_API_KEY environment variable not set in .env file.")
    sys.exit(1)

from workflow import builder
from langgraph.checkpoint.memory import MemorySaver

def main():
    print("==== ContentBox ====")
    print("Starting dual-agent content pipeline...\n")
    
    source = input("Enter a valid URL or raw text to process: ").strip()
    if not source:
        print("Empty input. Exiting.")
        return

    # Enable checkpointer to support interruption / human-in-the-loop
    memory = MemorySaver()
    # Interruption happens *before* executing the human_review node
    graph = builder.compile(checkpointer=memory, interrupt_before=["human_review"])

    # Setup the thread for LangGraph state persistence
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    state_input = {}
    if source.startswith("http://") or source.startswith("https://"):
        state_input["source_url"] = source
    else:
        state_input["raw_text"] = source

    try:
        # Phase 1: Research Agent
        print("\n[Agent 1: Research] Extracting facts & validating sources...")
        
        # stream() kicks off the graph until it reaches an END or an interrupt point.
        for event in graph.stream(state_input, config):
            if "process_input" in event:
                print("-> Scraped content length:", len(event["process_input"].get("extracted_content", "")))
            if "research" in event:
                print("-> Research completed.")

        # Check the paused state
        snapshot = graph.get_state(config)
        state = snapshot.values
        
        if "error" in state and state["error"]:
            print(f"Pipeline Error: {state['error']}")
            return

        if not snapshot.next:
            print("Pipeline finished unexpectedly. Check input.")
            return
            
        # Gate: Human Review Node
        print("\n==== 🛑 HUMAN VERIFICATION REQUIRED ====")
        flags = state.get("ambiguity_flags", [])
        if flags:
            print(f"⚠️ Ambiguities flagged by Agent 1:")
            for flag in flags:
                print(f" - {flag}")
        else:
            print("✔️ No ambiguities flagged.")
            
        print("-" * 40)
        print("FACT-SHEET:\n")
        print(state.get("fact_sheet", "No Fact-Sheet Generated."))
        print("-" * 40)

        review_file = "fact_sheet_review.md"
        with open(review_file, "w", encoding="utf-8") as f:
            f.write(state.get("fact_sheet", ""))
            
        print(f"\nWrote source fact-sheet to `{review_file}`.")
        print("Please review and manually resolve any flagged ambiguities in the file.")
        
        input("Press Enter when you have finished editing and saving the file...")

        # Read the verified changes
        with open(review_file, "r", encoding="utf-8") as f:
            updated_fact_sheet = f.read()
            
        print("\nResuming workflow... Passing verified Fact-Sheet to Agent 2")
        
        # Update the state internally at the node we interrupted
        graph.update_state(config, {"fact_sheet": updated_fact_sheet, "is_verified": True}, as_node="human_review")
        
        # Phase 2: Creative Agent
        for event in graph.stream(None, config):
            if "creative" in event:
                print("-> Final content generated.")

        # Output Final Results
        final_state = graph.get_state(config).values

        print("\n" + "="*40 + "\nFINAL DELIVERABLES\n" + "="*40)
        
        print("\n[ 1. BLOG POST ]\n")
        print(final_state.get('blog_post', 'N/A'))
        print("\n" + "-"*40)
        
        print("\n[ 2. SOCIAL MEDIA THREAD ]\n")
        print(final_state.get('social_thread', 'N/A'))
        print("\n" + "-"*40)
        
        print("\n[ 3. EMAIL TEASER ]\n")
        print(final_state.get('email_teaser', 'N/A'))
        print("\n" + "="*40)

    except Exception as e:
        print(f"\nError occurred during execution: {e}")

if __name__ == "__main__":
    main()
