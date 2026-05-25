// Global conversational state
let chatHistory = [];
let indexedDocuments = [];

// DOM Elements
const docList = document.getElementById('docList');
const docCount = document.getElementById('docCount');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const ingestProgress = document.getElementById('ingestProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const resetBtn = document.getElementById('resetBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
const floatingSidebarToggle = document.getElementById('floatingSidebarToggle');
const appContainer = document.querySelector('.app-container');

// Initialize web app
document.addEventListener('DOMContentLoaded', () => {
    fetchDocuments();
    setupDragAndDrop();
    setupTextAreaAutoGrow();
    setupThemeSwitcher();
    setupCollapsibleSidebar();
    setupSidebarAccordions();
});

// Setup collapsible layout logic
function setupCollapsibleSidebar() {
    const setSidebarCollapsed = (collapsed) => {
        if (collapsed) {
            appContainer.classList.add('sidebar-collapsed');
            sidebarExpandBtn.style.display = 'flex';
            if (floatingSidebarToggle) floatingSidebarToggle.style.display = 'flex';
            localStorage.setItem('sidebarCollapsed', 'true');
        } else {
            appContainer.classList.remove('sidebar-collapsed');
            sidebarExpandBtn.style.display = 'none';
            if (floatingSidebarToggle) floatingSidebarToggle.style.display = 'none';
            localStorage.setItem('sidebarCollapsed', 'false');
        }
    };

    // Read state from localStorage
    const sidebarCollapsedState = localStorage.getItem('sidebarCollapsed') === 'true';
    setSidebarCollapsed(sidebarCollapsedState);

    sidebarCollapseBtn.addEventListener('click', () => {
        setSidebarCollapsed(true);
    });

    sidebarExpandBtn.addEventListener('click', () => {
        setSidebarCollapsed(false);
    });

    if (floatingSidebarToggle) {
        floatingSidebarToggle.addEventListener('click', () => {
            setSidebarCollapsed(false);
        });
    }

    // Keyboard shortcut to toggle sidebar (Ctrl + \)
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '\\') {
            e.preventDefault();
            const isCollapsed = appContainer.classList.contains('sidebar-collapsed');
            setSidebarCollapsed(!isCollapsed);
        }
    });
}

// Setup sidebar accordion section collapsible logic
function setupSidebarAccordions() {
    const sections = [
        { id: 'kbSection', storageKey: 'kbSectionCollapsed' },
        { id: 'docsSection', storageKey: 'docsSectionCollapsed' }
    ];

    sections.forEach(({ id, storageKey }) => {
        const sectionEl = document.getElementById(id);
        if (!sectionEl) return;

        const header = sectionEl.querySelector('.section-header');
        const content = sectionEl.querySelector('.section-content');
        if (!content) return;

        // Function to expand section with smooth scrollHeight transition
        const expand = () => {
            sectionEl.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.opacity = '1';
            content.style.marginTop = '14px';
            localStorage.setItem(storageKey, 'false');
            
            // Remove fixed max-height after transition completes so that list additions/removals can adapt dynamically
            setTimeout(() => {
                if (!sectionEl.classList.contains('collapsed')) {
                    content.style.maxHeight = 'none';
                }
            }, 380);
        };

        // Function to collapse section smoothly
        const collapse = () => {
            // Set explicit height in px first to enable transition origin frame
            content.style.maxHeight = content.offsetHeight + 'px';
            // Force browser layout recalculation/reflow
            content.offsetHeight;
            
            sectionEl.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.marginTop = '0px';
            localStorage.setItem(storageKey, 'true');
        };

        // Read initial state from localStorage
        const isCollapsed = localStorage.getItem(storageKey) === 'true';
        if (isCollapsed) {
            sectionEl.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.style.marginTop = '0px';
        } else {
            sectionEl.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true');
            content.style.maxHeight = 'none';
            content.style.opacity = '1';
            content.style.marginTop = '14px';
        }

        header.addEventListener('click', () => {
            if (sectionEl.classList.contains('collapsed')) {
                expand();
            } else {
                collapse();
            }
        });
    });
}

// Setup visual theme switcher logic (Midnight Black vs Light Theme)
function setupThemeSwitcher() {
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');

    // Fetch user preference or default to midnight black
    const activeTheme = localStorage.getItem('theme') || 'dark';
    
    if (activeTheme === 'light') {
        document.body.classList.add('theme-light');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        document.body.classList.remove('theme-light');
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('theme-light');
        const isLightMode = document.body.classList.contains('theme-light');
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
        
        // Dynamic icons toggle
        if (isLightMode) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    });
}

// Fetch already vectorized documents from Qdrant
async function fetchDocuments() {
    try {
        const response = await fetch('/api/documents');
        const data = await response.json();
        indexedDocuments = data.documents || [];
        renderDocumentList();
    } catch (err) {
        console.error('Failed to retrieve indexed documents:', err);
    }
}

// Render document items in the sidebar
// Render document items in the sidebar with high-fidelity vector icons
function renderDocumentList() {
    docCount.textContent = indexedDocuments.length;
    
    if (indexedDocuments.length === 0) {
        docList.innerHTML = `
            <div class="empty-docs-state">
                <svg class="empty-box-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                </svg>
                <p>No documents uploaded yet. Ask queries from general knowledge or upload files to enable RAG.</p>
            </div>
        `;
        return;
    }
    
    docList.innerHTML = indexedDocuments.map(filename => {
        const ext = filename.split('.').pop().toUpperCase();
        let iconSvg = '';
        
        if (ext === 'PDF') {
            // PDF vector document icon
            iconSvg = `<svg class="doc-item-svg pdf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line><line x1="9" y1="11" x2="15" y2="11"></line></svg>`;
        } else if (ext === 'MD') {
            // Markdown vector document icon
            iconSvg = `<svg class="doc-item-svg md" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 12h8"></path><path d="M12 9v6"></path></svg>`;
        } else {
            // Text/generic document icon
            iconSvg = `<svg class="doc-item-svg txt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        }
        
        return `
            <div class="doc-item">
                <div class="doc-item-meta">
                    <span class="doc-item-icon">${iconSvg}</span>
                    <span class="doc-item-name" title="${filename}">${filename}</span>
                </div>
                <span class="doc-item-badge">${ext}</span>
            </div>
        `;
    }).join('');
}

// Setup file drag and drop listeners
function setupDragAndDrop() {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });
    
    // Fallback click trigger on drop zone (excluding the labels/buttons)
    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
            fileInput.click();
        }
    });
}

// Upload file to FastAPI upload endpoint
async function handleFileUpload(file) {
    const validExtensions = ['.pdf', '.txt', '.md'];
    const fileNameLower = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileNameLower.endsWith(ext));
    
    if (!isValid) {
        alert('Unsupported format. Please upload only PDF, TXT, or MD documents.');
        return;
    }
    
    // Prepare progress pane
    ingestProgress.style.display = 'flex';
    progressFill.style.width = '10%';
    progressText.textContent = `Uploading ${file.name}...`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        progressFill.style.width = '35%';
        progressText.textContent = `Analyzing file structure...`;
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        progressFill.style.width = '70%';
        progressText.textContent = `Generating vector embeddings & indexing in Qdrant...`;
        
        const result = await response.json();
        
        if (response.ok) {
            progressFill.style.width = '100%';
            progressText.textContent = `Successfully indexed!`;
            
            setTimeout(() => {
                ingestProgress.style.display = 'none';
                fetchDocuments();
                appendSystemMessage(`[ICON:book] Document **${file.name}** has been processed and indexed into Qdrant (${result.chunks} text chunks). RAG queries will now incorporate this context.`);
            }, 1000);
        } else {
            throw new Error(result.detail || 'Failed to parse and store document vectors.');
        }
    } catch (err) {
        progressFill.style.width = '0%';
        progressText.textContent = `Error occurred`;
        setTimeout(() => {
            ingestProgress.style.display = 'none';
            alert(`Vector Ingestion Failed: ${err.message}`);
        }, 1500);
    }
}

// Chat input form handling
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const queryText = chatInput.value.trim();
    if (!queryText) return;
    
    // Reset inputs
    chatInput.value = '';
    chatInput.rows = 1;
    
    // Hide welcome card if present
    const welcomeCard = document.querySelector('.welcome-card');
    if (welcomeCard) {
        welcomeCard.style.display = 'none';
    }
    
    // 1. Add User message to display
    appendMessage('user', queryText);
    
    // 2. Add Assistant message placeholder with loader
    const botMsgId = appendAssistantLoader();
    
    try {
        // 3. Post query to FastAPI RAG endpoint
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: queryText,
                history: chatHistory
            })
        });
        
        const result = await response.json();
        
        // 4. Remove loader bubble
        removeLoader(botMsgId);
        
        if (response.ok) {
            // 5. Render response with citations
            appendMessage('assistant', result.answer, result.citations);
            
            // 6. Push user query and answer to local conversational history
            chatHistory.push({ role: 'user', content: queryText });
            chatHistory.push({ role: 'assistant', content: result.answer });
        } else {
            throw new Error(result.detail || 'Encountered backend model generation error.');
        }
    } catch (err) {
        removeLoader(botMsgId);
        appendMessage('assistant', `[ICON:warning] **Error processing request:** ${err.message}`);
    }
});

// Auto-grow Textarea heights for sleek multi-line entries
function setupTextAreaAutoGrow() {
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight - 4) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
}

// Append a standard conversational bubble to the chat logs
function appendMessage(role, text, citations = []) {
    const row = document.createElement('div');
    row.classList.add('message-row', role);
    
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    
    // Dynamic mini markdown rendering
    bubble.innerHTML = parseMarkdown(text);
    
    // Render dynamic source citations if available
    if (citations && citations.length > 0) {
        const citationsWrapper = document.createElement('div');
        citationsWrapper.classList.add('citations-wrapper');
        
        const header = document.createElement('div');
        header.classList.add('citations-header');
        header.textContent = 'Retrieved Sources';
        citationsWrapper.appendChild(header);
        
        const list = document.createElement('div');
        list.classList.add('citations-list');
        
        // Drawer container for displaying exact clicked citation details
        const detailDrawer = document.createElement('div');
        detailDrawer.classList.add('citation-snippet-drawer');
        
        citations.forEach((cit, index) => {
            const pill = document.createElement('button');
            pill.classList.add('citation-pill');
            pill.innerHTML = `
                <span style="display: inline-flex; align-items: center; gap: 4px;">${getSvgIcon('folder')} ${cit.filename}</span>
                <span class="citation-confidence">${cit.confidence}</span>
            `;
            
            // Toggle preview text snippet drawer on click
            pill.addEventListener('click', () => {
                const isCurrentlySelected = detailDrawer.style.display === 'block' && detailDrawer.dataset.selectedIdx === String(index);
                
                if (isCurrentlySelected) {
                    detailDrawer.style.display = 'none';
                } else {
                    detailDrawer.style.display = 'block';
                    detailDrawer.dataset.selectedIdx = index;
                    detailDrawer.innerHTML = `
                        <span class="snippet-source-name">Snippet matching context (confidence score: ${cit.confidence})</span>
                        "${cit.snippet}"
                    `;
                    // Smoothly scroll down slightly to ensure snippet drawer is in focus
                    setTimeout(() => {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }, 50);
                }
            });
            list.appendChild(pill);
        });
        
        citationsWrapper.appendChild(list);
        citationsWrapper.appendChild(detailDrawer);
        bubble.appendChild(citationsWrapper);
    }
    
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    
    // Keep scroll aligned with bottom of chat window
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append specialized system event message (e.g. system cleanups)
function appendSystemMessage(text) {
    const systemRow = document.createElement('div');
    systemRow.style.display = 'flex';
    systemRow.style.justifyContent = 'center';
    systemRow.style.width = '100%';
    systemRow.style.margin = '12px 0';
    
    const banner = document.createElement('div');
    banner.style.background = 'hsla(217, 91%, 60%, 0.05)';
    banner.style.border = '1px solid var(--border-glass)';
    banner.style.color = 'var(--text-secondary)';
    banner.style.fontSize = '0.78rem';
    banner.style.padding = '8px 16px';
    banner.style.borderRadius = '20px';
    banner.style.maxWidth = '85%';
    banner.style.lineHeight = '1.5';
    banner.innerHTML = parseMarkdown(text);
    
    systemRow.appendChild(banner);
    chatMessages.appendChild(systemRow);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append temporary loading dot bubble while backend thinks
function appendAssistantLoader() {
    const id = 'loader_' + Date.now();
    const row = document.createElement('div');
    row.classList.add('message-row', 'assistant');
    row.id = id;
    
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    
    const typing = document.createElement('div');
    typing.classList.add('typing-bubble');
    typing.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    
    bubble.appendChild(typing);
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

// Remove the typing bubble after response returns
function removeLoader(id) {
    const loader = document.getElementById(id);
    if (loader) {
        loader.remove();
    }
}

// Wipes chatbot vector storage and cached directories
resetBtn.addEventListener('click', async () => {
    const confirmWipe = confirm(
        "WARNING: This will drop the active Qdrant Vector Collection and permanently delete all local cached document uploads.\n\nAre you sure you want to completely wipe the chatbot's memory?"
    );
    if (!confirmWipe) return;
    
    try {
        const response = await fetch('/api/reset', { method: 'POST' });
        const result = await response.json();
        
        if (response.ok) {
            // Wiped local state
            chatHistory = [];
            indexedDocuments = [];
            chatMessages.innerHTML = '';
            
            // Re-render empty assets state
            renderDocumentList();
            appendSystemMessage(`[ICON:sweep] **Wipe Complete:** All vector databases and local file caches have been cleared successfully.`);
            
            // Re-add welcome card back onto chat workspace with unified SVGs
            const welcomeHtml = `
                <div class="welcome-card">
                    <div class="welcome-icon-orb">
                        <svg class="welcome-spark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"></path>
                            <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5Z"></path>
                            <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"></path>
                        </svg>
                    </div>
                    <h3>Welcome to Antigravity RAG Chatbot</h3>
                    <p>This workspace connects a locally persistent **Qdrant Vector Database** with the **Google Gemini LLM** to provide precise context-aware answers.</p>
                    <div class="guide-steps">
                        <div class="step">
                            <span class="step-num">1</span>
                            <span>Upload documents via the side panel to chunk & vectorize.</span>
                        </div>
                        <div class="step">
                            <span class="step-num">2</span>
                            <span>Ask questions directly related to your uploaded texts.</span>
                        </div>
                        <div class="step">
                            <span class="step-num">3</span>
                            <span>Inspect source citations dynamically inline inside responses.</span>
                        </div>
                    </div>
                </div>
            `;
            chatMessages.innerHTML = welcomeHtml;
        } else {
            throw new Error(result.detail || 'Reset endpoint failed.');
        }
    } catch (err) {
        alert(`Memory wipe failed: ${err.message}`);
    }
});

// High-fidelity UI icon dictionary
function getSvgIcon(name, classes = "") {
    const iconClass = classes ? `svg-icon ${classes}` : "svg-icon";
    
    switch (name) {
        case 'book':
            return `<svg class="${iconClass} icon-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
        case 'sweep':
            return `<svg class="${iconClass} icon-sweep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"></path></svg>`;
        case 'warning':
            return `<svg class="${iconClass} icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        case 'folder':
            return `<svg class="${iconClass} icon-folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        default:
            return '';
    }
}

// Dynamic mini markdown compiler helper
function parseMarkdown(text) {
    let html = text;
    
    // Escape standard HTML tags to prevent cross-site-scripting (XSS)
    html = html
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt bridge;") // placeholder for browser rendering
        .replace(/&gt bridge;/g, "&gt;");
        
    // Format headers (### Header)
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    
    // Code blocks: ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold text: **bold** or *bold*
    html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');
    
    // Tables: simple markdown table support
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:| ]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
        const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
        const rows = bodyRows.split('\n')
            .map(r => r.split('|').map(c => c.trim()).filter(c => c))
            .filter(r => r.length);
            
        let tableHtml = '<table><thead><tr>';
        headers.forEach(h => tableHtml += `<th>${h}</th>`);
        tableHtml += '</tr></thead><tbody>';
        
        rows.forEach(r => {
            tableHtml += '<tr>';
            r.forEach(c => tableHtml += `<td>${c}</td>`);
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        return tableHtml;
    });

    // Unordered lists (- item)
    html = html.replace(/^\s*-\s+(.*)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    // Consolidate nested duplicate <ul> structures
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    
    // Handle double newlines as paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    
    // Handle single newlines as breaks
    html = html.replace(/\n/g, '<br>');
    
    // Post-process placeholders: replace [ICON:xxx] with inline SVG definitions
    html = html.replace(/\[ICON:([a-z-]+)\]/g, (match, iconName) => {
        return getSvgIcon(iconName);
    });
    
    return html;
}
