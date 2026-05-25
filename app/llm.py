import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from app.vector_store import search_similar

load_dotenv()

def get_llm() -> ChatGoogleGenerativeAI:
    """
    Connects to ChatGoogleGenerativeAI with safe API validation.
    """
    # Dynamically reload .env using absolute path to prevent working directory issues
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=env_path, override=True)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in your .env file.")
    
    return ChatGoogleGenerativeAI(
        model=os.getenv("LLM_MODEL", "gemini-1.5-flash"),
        google_api_key=api_key,
        temperature=0.3
    )

def generate_rag_response(query: str, chat_history: list = None) -> dict:
    """
    Performs similarity search, constructs dynamic system prompt with context chunks,
    integrates conversational history, and generates an answer with matching citations.
    """
    if chat_history is None:
        chat_history = []

    # 1. Retrieve Semantically Similar Chunks (top 5 for rich context)
    contexts = search_similar(query, limit=5)
    
    # 2. Build Context Text and Citation Metadata
    context_str = ""
    citations = []
    
    if contexts:
        context_parts = []
        # Keep track of unique sources cited in this search
        seen_citations = set()
        for idx, item in enumerate(contexts):
            context_parts.append(f"Source [{item['filename']}]:\n{item['text']}")
            
            # Format clean snippets for UI citation list
            filename = item["filename"]
            score_pct = int(item["score"] * 100)
            if filename not in seen_citations:
                seen_citations.add(filename)
                citations.append({
                    "filename": filename,
                    "confidence": f"{score_pct}%",
                    "snippet": item["text"][:150] + "..." if len(item["text"]) > 150 else item["text"]
                })
        context_str = "\n\n".join(context_parts)
    
    # 3. Formulate RAG-Oriented System Prompt
    system_instruction = (
        "You are Antigravity Chatbot, an expert AI assistant equipped with Retrieval-Augmented Generation (RAG).\n"
        "Your task is to answer the user's question accurately and professionally, utilizing the provided context documents.\n\n"
        "INSTRUCTIONS:\n"
        "1. Strictly use the provided Context Documents to answer the query if they are relevant.\n"
        "2. If the answer cannot be found in the context documents, but you have general knowledge to answer, answer but explicitly state that you are answering from general knowledge because the uploaded documents did not contain this information.\n"
        "3. Keep your tone professional, clear, and direct. Avoid repeating source names verbatim unless answering a citation question.\n"
        "4. Use clear Markdown format (bolding, tables, lists, code blocks) to make your response visually premium and readable.\n\n"
        "--- CONTEXT DOCUMENTS ---\n"
        f"{context_str if context_str else 'No documents have been uploaded or indexed yet.'}\n"
    )
    
    # 4. Assemble Conversational Message Log
    messages = [SystemMessage(content=system_instruction)]
    
    for msg in chat_history:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
            
    messages.append(HumanMessage(content=query))
    
    # 5. Invoke Gemini API Model
    try:
        llm = get_llm()
        response = llm.invoke(messages)
        answer = response.content
    except ValueError:
        answer = (
            "⚠️ **API Configuration Required**\n\n"
            "The `GEMINI_API_KEY` environment variable is currently missing or unset. "
            "To unlock the chatbot's conversational and document search capabilities, please do the following:\n\n"
            "1. Open the file **`.env`** in the root of your workspace folder.\n"
            "2. Set **`GEMINI_API_KEY`** to your actual Gemini API Key from Google AI Studio:\n"
            "   ```ini\n"
            "   GEMINI_API_KEY=your_actual_key_here\n"
            "   ```\n"
            "3. Save the file and restart the server."
        )
        citations = []
    except Exception as e:
        answer = (
            "⚠️ **API Connection Error**\n\n"
            "Failed to communicate with Google Gemini API. Please verify your internet connection "
            f"and check that your API key is active.\n\n*Details: {str(e)}*"
        )
        citations = []
        
    return {
        "answer": answer,
        "citations": citations
    }
