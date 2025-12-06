# AI Chat Wrapper

A ChatGPT-like web application with custom personality support, built with Flask and vanilla JavaScript.

## Features

- Real-time streaming responses (like ChatGPT)
- Customizable AI personality via `personality.txt`
- Clean, modern chat interface
- Conversation history management
- Ready for MySQL integration

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure API key:**
   - Open `.env` file
   - Replace `your_openai_api_key_here` with your actual OpenAI API key

3. **Customize personality:**
   - Edit `personality.txt` to change the AI's personality and behavior
   - The content of this file will be used as the system prompt

4. **Run the application:**
   ```bash
   python app.py
   ```

5. **Open in browser:**
   - Navigate to `http://localhost:5000`

## Project Structure

```
.
├── app.py                 # Flask backend
├── personality.txt        # AI personality/system prompt
├── requirements.txt       # Python dependencies
├── .env                  # Environment variables (API key)
├── templates/
│   └── index.html        # Frontend HTML
└── static/
    ├── css/
    │   └── style.css     # Styling
    └── js/
        └── script.js     # Frontend logic
```

## Customization

### Changing the AI Personality

Edit `personality.txt` to modify how the AI behaves. For example:
- "You are a friendly and humorous assistant who loves to tell jokes."
- "You are a professional technical assistant specializing in software development."
- "You are a creative writing coach who helps with storytelling."

### Changing the Model

In `app.py`, modify the `model` parameter in the `chat()` function:
```python
stream = client.chat.completions.create(
    model='gpt-3.5-turbo',  # Change this
    ...
)
```

## Next Steps

- Add MySQL database integration for conversation history
- Add user authentication
- Add conversation management (save, load, delete conversations)

