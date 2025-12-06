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
            <div class="message-content">
                Hello! How can I help you today?
            </div>
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
    messageDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
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
                    // Remove streaming cursor
                    contentElement.innerHTML = escapeHtml(aiResponse);
                    
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
                                // Update content with streaming cursor
                                contentElement.innerHTML = escapeHtml(aiResponse) + '<span class="streaming-cursor"></span>';
                                scrollToBottom();
                            }
                            
                            if (data.done) {
                                // Remove streaming cursor
                                contentElement.innerHTML = escapeHtml(aiResponse);
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
