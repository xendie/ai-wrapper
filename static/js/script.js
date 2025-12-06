// Global state
let currentConversationId = null;
let conversationHistory = [];
let conversations = [];
let isAuthenticated = false;

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const conversationsList = document.getElementById('conversationsList');
const newChatButton = document.getElementById('newChatButton');
const logoutButton = document.getElementById('logoutButton');
const usernameDisplay = document.getElementById('usernameDisplay');
const conversationTitle = document.getElementById('conversationTitle');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication (optional)
    await checkAuth();
    
    // Load conversations only if authenticated
    if (isAuthenticated) {
        await loadConversations();
    } else {
        // Hide sidebar or show login prompt
        updateUIForGuest();
    }
    
    // Setup event listeners
    setupEventListeners();
});

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.authenticated) {
            isAuthenticated = true;
            usernameDisplay.textContent = data.user.username;
            // Show logout button
            if (logoutButton) {
                logoutButton.style.display = 'block';
            }
        } else {
            isAuthenticated = false;
            usernameDisplay.textContent = 'Guest';
            // Show login link instead of logout
            if (logoutButton) {
                logoutButton.textContent = 'Login';
                logoutButton.onclick = () => window.location.href = '/login';
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        isAuthenticated = false;
        updateUIForGuest();
    }
}

function updateUIForGuest() {
    // Hide conversation list or show message
    if (conversationsList) {
        conversationsList.innerHTML = '<div style="padding: 12px; color: #999; font-size: 14px; text-align: center;">Login to save conversations</div>';
    }
    if (usernameDisplay) {
        usernameDisplay.textContent = 'Guest';
    }
    if (logoutButton) {
        logoutButton.textContent = 'Login';
        logoutButton.onclick = () => window.location.href = '/login';
    }
}

async function loadConversations() {
    if (!isAuthenticated) {
        return;
    }
    
    try {
        const response = await fetch('/api/conversations', {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            conversations = data.conversations;
            renderConversations();
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

function renderConversations() {
    conversationsList.innerHTML = '';
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <span class="conversation-title" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title)}</span>
            <button class="conversation-delete" data-id="${conv.id}" title="Delete">×</button>
        `;
        
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('conversation-delete')) {
                e.stopPropagation();
                deleteConversation(conv.id);
            } else {
                loadConversation(conv.id);
            }
        });
        
        conversationsList.appendChild(item);
    });
}

async function loadConversation(conversationId) {
    if (!isAuthenticated) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (response.ok) {
            currentConversationId = conversationId;
            conversationHistory = data.messages;
            conversationTitle.textContent = data.title;
            
            // Clear and reload messages
            chatMessages.innerHTML = '';
            conversationHistory.forEach(msg => {
                addMessage(msg.role, msg.content, false);
            });
            
            // Update active conversation in sidebar
            renderConversations();
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}

async function deleteConversation(conversationId) {
    if (!isAuthenticated) {
        return;
    }
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            // Remove from list
            conversations = conversations.filter(c => c.id !== conversationId);
            
            // If it was the current conversation, start a new one
            if (currentConversationId === conversationId) {
                startNewConversation();
            } else {
                renderConversations();
            }
        }
    } catch (error) {
        console.error('Failed to delete conversation:', error);
    }
}

function startNewConversation() {
    currentConversationId = null;
    conversationHistory = [];
    conversationTitle.textContent = 'New Chat';
    chatMessages.innerHTML = `
        <div class="message ai-message">
            <div class="message-content">Hello! How can I help you today?</div>
        </div>
    `;
    renderConversations();
}

function setupEventListeners() {
    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
    
    // Send message on Enter (Shift+Enter for new line)
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Send button click
    sendButton.addEventListener('click', sendMessage);
    
    // New chat button
    newChatButton.addEventListener('click', startNewConversation);
    
    // Logout button (only if authenticated, otherwise it's a login button)
    if (logoutButton && isAuthenticated) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
                // Reload page to reset state
                window.location.reload();
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }
    
    // Sidebar toggle (mobile)
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || sendButton.disabled) return;
    
    // Disable input while processing
    sendButton.disabled = true;
    messageInput.disabled = true;
    
    // Add user message to UI
    addMessage('user', message);
    
    // Add to conversation history
    conversationHistory.push({ role: 'user', content: message });
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Create AI message placeholder
    const aiMessageElement = addMessage('ai', '');
    const aiContentElement = aiMessageElement.querySelector('.message-content');
    
    // Start streaming
    streamResponse(message, aiContentElement);
}

function addMessage(role, content, scroll = true) {
    const messageDiv = document.createElement('div');
    // Normalize 'assistant' role to 'ai' for CSS class consistency
    const normalizedRole = role === 'assistant' ? 'ai' : role;
    messageDiv.className = `message ${normalizedRole}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Parse markdown code blocks and render as HTML
    contentDiv.innerHTML = parseMarkdownCodeBlocks(content);
    
    // Highlight code blocks
    highlightCode(contentDiv);
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    if (scroll) {
        scrollToBottom();
    }
    
    return messageDiv;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function streamResponse(userMessage, contentElement) {
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            message: userMessage,
            conversation_id: currentConversationId,
            history: conversationHistory.slice(0, -1) // Exclude the message we just added
        })
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Network response was not ok');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiResponse = '';
        let receivedConversationId = null;
        
        function readStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    // Remove streaming cursor and parse markdown
                    contentElement.innerHTML = parseMarkdownCodeBlocks(aiResponse);
                    highlightCode(contentElement);
                    
                    // Add AI response to conversation history
                    conversationHistory.push({ role: 'assistant', content: aiResponse });
                    
                    // Update conversation ID if this was a new conversation (only if authenticated)
                    if (receivedConversationId && !currentConversationId && isAuthenticated) {
                        currentConversationId = receivedConversationId;
                        // Reload conversations to get the new one
                        loadConversations();
                    }
                    
                    // Re-enable input
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                    messageInput.focus();
                    scrollToBottom();
                    return;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.error) {
                                contentElement.textContent = `Error: ${data.error}`;
                                sendButton.disabled = false;
                                messageInput.disabled = false;
                                return;
                            }
                            
                            if (data.conversation_id) {
                                receivedConversationId = data.conversation_id;
                            }
                            
                            if (data.content) {
                                aiResponse += data.content;
                                // Update content with streaming cursor (parse markdown for code blocks)
                                contentElement.innerHTML = parseMarkdownCodeBlocks(aiResponse) + '<span class="streaming-cursor"></span>';
                                highlightCode(contentElement);
                                scrollToBottom();
                            }
                            
                            if (data.done) {
                                // Remove streaming cursor and parse markdown
                                contentElement.innerHTML = parseMarkdownCodeBlocks(aiResponse);
                                highlightCode(contentElement);
                                conversationHistory.push({ role: 'assistant', content: aiResponse });
                                
                                // Update conversation ID if this was a new conversation (only if authenticated)
                                if (receivedConversationId && !currentConversationId && isAuthenticated) {
                                    currentConversationId = receivedConversationId;
                                    loadConversations();
                                }
                                
                                sendButton.disabled = false;
                                messageInput.disabled = false;
                                messageInput.focus();
                                scrollToBottom();
                                return;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
                
                return readStream();
            });
        }
        
        return readStream();
    })
    .catch(error => {
        console.error('Error:', error);
        contentElement.textContent = `Error: ${error.message}`;
        sendButton.disabled = false;
        messageInput.disabled = false;
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseMarkdownCodeBlocks(text) {
    // First, handle inline code (single backticks) - but not inside code blocks
    // We'll do this in a second pass after handling code blocks
    
    // Split text by code blocks (```language\ncode\n``` or ```\ncode\n```)
    // This regex handles both cases: with or without language, and with optional newline after ```
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Add text before code block (escaped and with inline code handling)
        if (match.index > lastIndex) {
            const textBefore = text.substring(lastIndex, match.index);
            if (textBefore.trim()) {
                parts.push({ type: 'text', content: textBefore });
            }
        }
        
        // Add code block
        const language = match[1] || 'text';
        const code = match[2].trim(); // Remove leading/trailing whitespace
        parts.push({ type: 'code', language: language, content: code });
        
        lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last code block
    if (lastIndex < text.length) {
        const textAfter = text.substring(lastIndex);
        if (textAfter.trim()) {
            parts.push({ type: 'text', content: textAfter });
        }
    }
    
    // If no code blocks found, process as text only
    if (parts.length === 0) {
        return processInlineCode(escapeHtml(text));
    }
    
    // Build HTML from parts
    let html = '';
    parts.forEach(part => {
        if (part.type === 'text') {
            // Process inline code and escape HTML, then convert newlines to <br>
            const processed = processInlineCode(escapeHtml(part.content));
            html += processed.replace(/\n/g, '<br>');
        } else if (part.type === 'code') {
            // Create code block with language class and copy button
            const escapedCode = escapeHtml(part.content);
            html += `<div class="code-block-wrapper">
                <pre class="code-block"><code class="language-${part.language}">${escapedCode}</code>
                    <button class="copy-code-button" title="Copy code" aria-label="Copy code">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </pre>
            </div>`;
        }
    });
    
    return html;
}

function processInlineCode(text) {
    // Handle inline code (single backticks)
    // Simple regex that matches `code` - works for most cases
    // Note: This won't perfectly handle edge cases with triple backticks in text,
    // but code blocks are handled separately so this should work fine
    // The text is already escaped, so we just need to wrap matches in code tags
    return text.replace(/`([^`\n]+)`/g, (match, codeContent) => {
        // Code content is already escaped from escapeHtml, so we can use it directly
        return `<code class="inline-code">${codeContent}</code>`;
    });
}

function highlightCode(element) {
    // Use Prism to highlight code blocks
    if (typeof Prism !== 'undefined') {
        const codeBlocks = element.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            Prism.highlightElement(block);
        });
    }
    
    // Setup copy buttons for code blocks
    setupCopyButtons(element);
}

function setupCopyButtons(container) {
    const copyButtons = container.querySelectorAll('.copy-code-button');
    copyButtons.forEach(button => {
        // Remove existing event listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async () => {
            const codeBlock = newButton.closest('.code-block');
            const code = codeBlock.querySelector('code');
            const codeText = code.textContent || code.innerText;
            
            try {
                await navigator.clipboard.writeText(codeText);
                
                // Visual feedback
                const originalHTML = newButton.innerHTML;
                newButton.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                newButton.classList.add('copied');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    newButton.innerHTML = originalHTML;
                    newButton.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code:', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = codeText;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    const originalHTML = newButton.innerHTML;
                    newButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    `;
                    newButton.classList.add('copied');
                    setTimeout(() => {
                        newButton.innerHTML = originalHTML;
                        newButton.classList.remove('copied');
                    }, 2000);
                } catch (fallbackErr) {
                    console.error('Fallback copy failed:', fallbackErr);
                }
                document.body.removeChild(textArea);
            }
        });
    });
}
