from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI
import os
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

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

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        if not client:
            return jsonify({'error': 'OpenAI API key not configured. Please set OPENAI_API_KEY in .env file'}), 500
        
        data = request.json
        user_message = data.get('message', '')
        conversation_history = data.get('history', [])
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
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
        def generate():
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
                        # Send as Server-Sent Events format
                        yield f"data: {json.dumps({'content': content})}\n\n"
                
                # Send completion signal
                yield f"data: {json.dumps({'done': True})}\n\n"
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

@app.route('/')
def index():
    from flask import render_template
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

