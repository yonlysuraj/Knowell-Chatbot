# Antigravity RAG Chatbot with Qdrant and FastAPI

Welcome to the **Antigravity RAG Chatbot** workspace! This is a state-of-the-art, premium Retrieval-Augmented Generation (RAG) conversational interface powered by a **Python FastAPI** backend, a locally persistent **Qdrant Vector Database**, and **Google Gemini LLMs**.

---

## Key Features

- **Local Vector Database (Zero Setup):** By default, Qdrant is configured to run in **disk-based local mode** (`local_db`). No Docker installations or cloud accounts are needed!
- **Intelligent RAG pipeline:** Documents are cleanly parsed (supporting PDF, TXT, and MD), chunked with semantic overlap, embedded, and stored.
- **Advanced Citations Panel:** The chatbot lists the exact documents retrieved from Qdrant, complete with a clickable **Snippet Drawer** that highlights the precise text referenced by the AI model.
- **Stunning Glassmorphic Interface:** A fully responsive web page with subtle gradients, hovering glows, drag-and-drop file ingestion, a local progress bar, and typing indicators.
- **Safe Keys Configuration:** If your Gemini API Key is missing, the web app displays a beautiful notification explaining how to add your key rather than crashing the server.

---

## File Structure

```
Chatbot/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI server, REST API endpoints, and web routes
│   ├── llm.py               # Google Gemini chat models & dynamic prompt templates
│   ├── vector_store.py      # Qdrant integration, text extraction, chunking, and semantic search
│   └── static/              # Sleek glassmorphic web app
│       ├── index.html       # Dynamic markup structure
│       ├── style.css        # Premium stylesheets and responsive layout
│       └── app.js           # Client-side messaging, file-drop uploader, and citations
├── data/                    # Cache folder for raw uploaded documents
├── local_qdrant_db/         # Automatically created folder for local Qdrant vectors
├── requirements.txt         # Project package dependencies
├── .env                     # App configuration and API key storage
└── README.md                # Project walkthrough (this file!)
```

---

## Installation & Setup

Follow these steps to run the application locally on your system:

### 1. Install Dependencies
Ensure you have Python 3.9+ installed, then run the following command in your terminal to install the necessary libraries:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Open the `.env` file in the root folder and add your **Google Gemini API Key** (which you can get for free from [Google AI Studio](https://aistudio.google.com/)):
```ini
GEMINI_API_KEY=your_actual_api_key_here
```

---

## Running the Application

Start the backend web server by running the following command in your terminal:
```bash
uvicorn app.main:app --reload
```

Once the server is running, open your web browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

---

## Usage Guide

1. **Ask general questions:** Simply start typing in the chat container to talk to the AI using its standard baseline knowledge.
2. **Vectorize documents:** Drag and drop any `.pdf`, `.txt`, or `.md` file into the left sidebar, or click the **Browse Files** button. The app will visually animate the progress as it parses, chunks, and indexes it into Qdrant.
3. **Ask contextual questions:** Ask queries specifically related to your document (e.g. *"Summarize section 4 of the project spec"*).
4. **Inspect source citations:** Click on any of the document pills listed underneath the chatbot's response to expand the **Snippet Drawer** and view the exact text chunk extracted from Qdrant!
5. **Reset storage:** To clear the vector database and wipe the workspace cache, click **Wipe Chatbot Memory** in the sidebar.
