from flask import Flask, request, jsonify, Response, stream_with_context, session, redirect, url_for, render_template
from flask_cors import CORS
from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import re
import bcrypt
from functools import wraps
import database

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
CORS(app, supports_credentials=True)

# Session configuration
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Initialize OpenAI client
api_key = os.getenv('OPENAI_API_KEY')
if not api_key or api_key == 'your_openai_api_key_here':
    print("Warning: OPENAI_API_KEY not set in .env file")
client = OpenAI(api_key=api_key) if api_key else None

def load_personality():
    """Load personality from static file"""
    try:
        with open('personality.txt', 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return "You are a helpful AI assistant."

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def generate_conversation_title(user_message):
    """Generate a title from the first user message (max 50 chars)"""
    # Remove extra whitespace and limit length
    title = ' '.join(user_message.split()[:10])  # First 10 words
    if len(title) > 50:
        title = title[:47] + '...'
    return title if title else 'New Conversation'

# Authentication routes
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        # Validation
        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400
        
        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Check if username or email already exists
        if database.get_user_by_username(username):
            return jsonify({'error': 'Username already exists'}), 400
        
        if database.get_user_by_email(email):
            return jsonify({'error': 'Email already exists'}), 400
        
        # Hash password with bcrypt
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Create user
        user_id = database.create_user(username, email, password_hash)
        
        # Create session
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({'message': 'Registration successful', 'user': {'id': user_id, 'username': username}}), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        # Get user
        user = database.get_user_by_username(username)
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create session
        session['user_id'] = user['id']
        session['username'] = user['username']
        
        return jsonify({'message': 'Login successful', 'user': {'id': user['id'], 'username': user['username']}}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        user = database.get_user_by_id(session['user_id'])
        if user:
            return jsonify({'authenticated': True, 'user': {'id': user['id'], 'username': user['username']}}), 200
    return jsonify({'authenticated': False}), 200

# Conversation routes (require authentication)
@app.route('/api/conversations', methods=['GET'])
@require_auth
def get_conversations():
    try:
        user_id = session['user_id']
        conversations = database.get_conversations_by_user(user_id)
        return jsonify({'conversations': conversations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations', methods=['POST'])
@require_auth
def create_conversation():
    try:
        user_id = session['user_id']
        data = request.json
        title = data.get('title', 'New Conversation')
        
        conversation_id = database.create_conversation(user_id, title)
        return jsonify({'id': conversation_id, 'title': title}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['GET'])
@require_auth
def get_conversation(conversation_id):
    try:
        user_id = session['user_id']
        conversation = database.get_conversation_by_id(conversation_id, user_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Format messages for frontend (exclude system messages)
        formatted_messages = [
            {'role': msg['role'], 'content': msg['content']} 
            for msg in conversation.get('messages', [])
            if msg['role'] != 'system'
        ]
        
        return jsonify({
            'id': conversation['id'],
            'title': conversation['title'],
            'messages': formatted_messages
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conversation_id):
    try:
        user_id = session['user_id']
        database.delete_conversation(conversation_id, user_id)
        return jsonify({'message': 'Conversation deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<int:conversation_id>/title', methods=['PUT'])
@require_auth
def update_conversation_title(conversation_id):
    try:
        user_id = session['user_id']
        data = request.json
        title = data.get('title', '').strip()
        
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        
        database.update_conversation_title(conversation_id, user_id, title)
        return jsonify({'message': 'Title updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Chat route (updated)
@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        if not client:
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file'}), 500
        
        # Check if user is authenticated (optional)
        user_id = session.get('user_id')
        data = request.json
        user_message = data.get('message', '')
        conversation_id = data.get('conversation_id')
        conversation_history = data.get('history', [])
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Only use database if user is logged in
        if user_id:
            # Get or create conversation
            if conversation_id:
                conversation = database.get_conversation_by_id(conversation_id, user_id)
                if not conversation:
                    return jsonify({'error': 'Conversation not found'}), 404
                # Load conversation history from database if not provided
                if not conversation_history:
                    conversation_history = [
                        {'role': msg['role'], 'content': msg['content']} 
                        for msg in conversation.get('messages', [])
                        if msg['role'] != 'system'
                    ]
            else:
                # Create new conversation with auto-generated title
                title = generate_conversation_title(user_message)
                conversation_id = database.create_conversation(user_id, title)
            
            # Save user message to database
            database.create_message(conversation_id, 'user', user_message)
        
        # Load personality
        system_prompt = load_personality()
        
        # Build messages array with system prompt and conversation history
        messages = [{'role': 'system', 'content': system_prompt}]
        
        # Add conversation history
        for msg in conversation_history:
            messages.append(msg)
        
        # Add current user message
        messages.append({'role': 'user', 'content': user_message})
        
        # Stream response from OpenAI
        assistant_response = ''
        
        def generate():
            nonlocal assistant_response
            try:
                stream = client.chat.completions.create(
                    model='gpt-4',
                    messages=messages,
                    stream=True,
                    temperature=0.7
                )
                
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        content = chunk.choices[0].delta.content
                        assistant_response += content
                        # Send as Server-Sent Events format
                        yield f"data: {json.dumps({'content': content, 'conversation_id': conversation_id})}\n\n"
                
                # Save assistant response to database (only if logged in)
                if assistant_response and user_id and conversation_id:
                    database.create_message(conversation_id, 'assistant', assistant_response)
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True, 'conversation_id': conversation_id})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Test route
@app.route('/test', methods=['GET'])
def test():
    return jsonify({'status': 'ok', 'message': 'App is running'}), 200

# Frontend routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

