import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from typing import List
from app.vector_store import index_document, get_indexed_documents, reset_vector_store
from app.llm import generate_rag_response

app = FastAPI(title="Antigravity RAG Chatbot")

# Create local data cache directory if it doesn't exist
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Pydantic validation models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: List[ChatMessage] = []

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    RAG Chat endpoint. Searches Qdrant for context, then submits context + query to LLM.
    """
    # Convert pydantic chat messages to native dictionaries for LangChain integration
    history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
    try:
        response = generate_rag_response(request.query, history_dicts)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Uploads a document, parses it, extracts text, chunks it, and indexes into Qdrant.
    """
    filename = file.filename
    if not filename.lower().endswith(('.pdf', '.txt', '.md')):
        raise HTTPException(
            status_code=400, 
            detail="Unsupported format. Only documents with .pdf, .txt, or .md extensions are accepted."
        )
    
    file_path = os.path.join(DATA_DIR, filename)
    try:
        # Save uploaded file stream to local cache directory
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Parse and chunk-index the document vectors
        num_chunks = index_document(file_path, filename)
        return {
            "status": "success",
            "filename": filename,
            "chunks": num_chunks,
            "message": f"Successfully loaded '{filename}' and indexed {num_chunks} vector chunks."
        }
    except Exception as e:
        # Clean up file copy if indexing encountered an error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to parse and index document: {str(e)}")

@app.get("/api/documents")
async def get_documents():
    """
    Lists unique filenames currently indexed in the vector store database.
    """
    try:
        docs = get_indexed_documents()
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch document list: {str(e)}")

@app.post("/api/reset")
async def reset():
    """
    Drops the vector collection and wipes out local document files cache.
    """
    try:
        # Reset Qdrant
        reset_vector_store()
        
        # Clean up raw files directory
        for filename in os.listdir(DATA_DIR):
            file_path = os.path.join(DATA_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to clear resource {file_path}: {e}")
                
        return {
            "status": "success", 
            "message": "Chatbot memory reset successfully. Database and cached files have been wiped."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset operation failed: {str(e)}")

# Ensure frontend directories exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Main route fallback (delivers index.html directly)
@app.get("/")
async def read_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse(
        "<html>"
        "<head><title>Antigravity Chatbot</title></head>"
        "<body style='font-family: sans-serif; text-align: center; padding: 50px; background-color: #0d0f14; color: #fff;'>"
        "<h1>Antigravity RAG Chatbot Server</h1>"
        "<p>Backend is fully functional. Please wait while frontend assets are generated...</p>"
        "</body>"
        "</html>"
    )

# Serve static web app assets
app.mount("/", StaticFiles(directory=STATIC_DIR), name="static")
