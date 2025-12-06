const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Store conversation history
let conversationHistory = [];

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

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollToBottom();
    
    return messageDiv;
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function streamResponse(userMessage, contentElement) {
    // Use fetch with streaming for POST requests
    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: userMessage,
            history: conversationHistory
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let aiResponse = '';
        
        function readStream() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    // Remove streaming cursor
                    contentElement.innerHTML = aiResponse;
                    // Add AI response to conversation history
                    conversationHistory.push({ role: 'assistant', content: aiResponse });
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

