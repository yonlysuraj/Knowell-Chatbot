import os
import uuid
import pypdf
from qdrant_client import QdrantClient
from qdrant_client.http import models
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

QDRANT_HOST = os.getenv("QDRANT_HOST", "local_db")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "chatbot_knowledge")

_qdrant_client = None

def get_qdrant_client() -> QdrantClient:
    """
    Initializes and returns the Qdrant Client based on configuration as a shared singleton.
    Supports in-memory, local directory, docker or cloud setups.
    """
    global _qdrant_client
    if _qdrant_client is None:
        if QDRANT_HOST == "local_db":
            # Disk-based local database persistence. No Docker needed!
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_qdrant_db")
            os.makedirs(db_path, exist_ok=True)
            _qdrant_client = QdrantClient(path=db_path)
        elif QDRANT_HOST == ":memory:":
            # Pure RAM-based temporary database.
            _qdrant_client = QdrantClient(location=":memory:")
        else:
            # Remote connection (Docker instance or Qdrant Cloud)
            url = QDRANT_HOST if QDRANT_HOST.startswith("http") else f"http://{QDRANT_HOST}:{QDRANT_PORT}"
            _qdrant_client = QdrantClient(url=url)
    return _qdrant_client

def get_embeddings_model() -> GoogleGenerativeAIEmbeddings:
    """
    Initializes and returns the Google Gemini Embeddings model.
    Checks API Key availability and throws a user-friendly error if missing.
    """
    # Dynamically reload .env using absolute path to prevent working directory issues
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=env_path, override=True)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please open the '.env' file in your project "
            "and add your valid Gemini API Key to enable embeddings and chatbot logic."
        )
    return GoogleGenerativeAIEmbeddings(
        model=os.getenv("EMBEDDING_MODEL", "models/gemini-embedding-001"),
        google_api_key=api_key
    )

def get_embedding_dimension(embeddings: GoogleGenerativeAIEmbeddings) -> int:
    """
    Dynamically checks and returns the embedding dimension size.
    """
    try:
        return len(embeddings.embed_query("test"))
    except Exception as e:
        # Fallback to standard dimension for models/text-embedding-004 (768)
        return 768

def chunk_text(text: str, chunk_size: int = 600, chunk_overlap: int = 100) -> list:
    """
    Splits text into logical semantic chunks with overlapping windowing.
    Ensures chunks do not break sentences or words abruptly.
    """
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        
        # Try to find a natural sentence boundary or space near the end to cut cleanly
        if end < text_length:
            best_cut = end
            # Look back up to 80 characters for a natural boundary
            for i in range(end, max(start, end - 80), -1):
                if text[i] in ['.', '!', '?', '\n']:
                    best_cut = i + 1  # Include the punctuation
                    break
                elif text[i] == ' ' and best_cut == end:
                    best_cut = i
            end = best_cut

        chunk = text[start:end].strip()
        if len(chunk) > 15:  # Filter out trivial fragments
            chunks.append(chunk)
            
        start = end - chunk_overlap
        if start < 0 or end >= text_length:
            break
            
    return chunks

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extracts text page-by-page from a PDF file using pypdf.
    """
    text = ""
    try:
        reader = pypdf.PdfReader(file_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        raise IOError(f"Failed to read PDF document '{file_path}': {e}")
    return text

def init_vector_store():
    """
    Initializes Qdrant Client, Embeddings, and ensures the target collection exists.
    Auto-detects and heals dimension mismatches when embedding configurations change.
    """
    client = get_qdrant_client()
    embeddings = get_embeddings_model()
    dim = get_embedding_dimension(embeddings)
    
    # Check if the target collection already exists
    collections = client.get_collections().collections
    exists = any(c.name == QDRANT_COLLECTION for c in collections)
    
    if exists:
        try:
            info = client.get_collection(QDRANT_COLLECTION)
            existing_size = info.config.params.vectors.size
            if existing_size != dim:
                # Dimension mismatch detected! Delete and recreate fresh
                client.delete_collection(QDRANT_COLLECTION)
                exists = False
        except Exception:
            pass
            
    if not exists:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=models.VectorParams(
                size=dim,
                distance=models.Distance.COSINE
            )
        )
    return client, embeddings

def index_document(file_path: str, filename: str) -> int:
    """
    Reads a document (PDF or Text), parses, chunks, generates embeddings,
    and indexes them into the Qdrant database.
    """
    client, embeddings = init_vector_store()
    
    # 1. Parse File Content
    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(file_path)
    else:
        # Load as raw text file
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
            
    if not text.strip():
        raise ValueError(f"No readable text content found in document '{filename}'.")
        
    # 2. Slice text into chunks
    chunks = chunk_text(text)
    if not chunks:
        return 0
        
    # 3. Create Vector Embeddings
    vectors = embeddings.embed_documents(chunks)
    
    # 4. Upload to Qdrant
    points = []
    for idx, (chunk, vector) in enumerate(zip(chunks, vectors)):
        point_id = str(uuid.uuid4())
        points.append(
            models.PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "filename": filename,
                    "chunk_index": idx,
                    "text": chunk
                }
            )
        )
        
    client.upsert(
        collection_name=QDRANT_COLLECTION,
        points=points
    )
    return len(chunks)

def search_similar(query: str, limit: int = 4) -> list:
    """
    Searches the Qdrant database for chunks semantically similar to the query.
    Returns a list of dicts with matching chunk text and metadata.
    """
    try:
        client, embeddings = init_vector_store()
    except ValueError as e:
        # Graceful handling if api key is missing on initial query
        return []
        
    query_vector = embeddings.embed_query(query)
    
    # Use modern query_points API introduced in v1.18+
    response = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=query_vector,
        limit=limit
    )
    
    return [
        {
            "text": r.payload["text"],
            "filename": r.payload["filename"],
            "score": r.score
        }
        for r in response.points
    ]

def get_indexed_documents() -> list:
    """
    Retrieves unique list of document names indexed in the collection.
    """
    try:
        client = get_qdrant_client()
        # Verify collection exists first
        collections = client.get_collections().collections
        exists = any(c.name == QDRANT_COLLECTION for c in collections)
        if not exists:
            return []
            
        # Scroll through database to extract unique filenames from payloads
        scroll_result = client.scroll(
            collection_name=QDRANT_COLLECTION,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )
        
        points = scroll_result[0]
        filenames = set()
        for p in points:
            if p.payload and "filename" in p.payload:
                filenames.add(p.payload["filename"])
        return sorted(list(filenames))
    except Exception:
        return []

def reset_vector_store():
    """
    Resets the vector database by dropping the active collection.
    """
    client = get_qdrant_client()
    collections = client.get_collections().collections
    exists = any(c.name == QDRANT_COLLECTION for c in collections)
    if exists:
        client.delete_collection(collection_name=QDRANT_COLLECTION)
