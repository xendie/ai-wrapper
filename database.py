import pymysql
import os
from dotenv import load_dotenv
from contextlib import contextmanager
from functools import wraps

load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    'autocommit': False
}

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = pymysql.connect(**DB_CONFIG)
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a database query"""
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if fetch_one:
                return cursor.fetchone()
            elif fetch_all:
                return cursor.fetchall()
            return cursor.lastrowid

# User operations
def create_user(username, email, password_hash):
    """Create a new user"""
    query = "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)"
    return execute_query(query, (username, email, password_hash))

def get_user_by_username(username):
    """Get user by username"""
    query = "SELECT * FROM users WHERE username = %s"
    return execute_query(query, (username,), fetch_one=True)

def get_user_by_email(email):
    """Get user by email"""
    query = "SELECT * FROM users WHERE email = %s"
    return execute_query(query, (email,), fetch_one=True)

def get_user_by_id(user_id):
    """Get user by ID"""
    query = "SELECT id, username, email, created_at FROM users WHERE id = %s"
    return execute_query(query, (user_id,), fetch_one=True)

# Conversation operations
def create_conversation(user_id, title):
    """Create a new conversation"""
    query = "INSERT INTO conversations (user_id, title) VALUES (%s, %s)"
    return execute_query(query, (user_id, title))

def get_conversations_by_user(user_id):
    """Get all conversations for a user, ordered by updated_at DESC"""
    query = """
        SELECT id, title, created_at, updated_at 
        FROM conversations 
        WHERE user_id = %s 
        ORDER BY updated_at DESC
    """
    return execute_query(query, (user_id,), fetch_all=True)

def get_conversation_by_id(conversation_id, user_id):
    """Get a specific conversation with messages, ensuring it belongs to the user"""
    # Get conversation
    conv_query = "SELECT * FROM conversations WHERE id = %s AND user_id = %s"
    conversation = execute_query(conv_query, (conversation_id, user_id), fetch_one=True)
    
    if not conversation:
        return None
    
    # Get messages
    msg_query = "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC"
    messages = execute_query(msg_query, (conversation_id,), fetch_all=True)
    
    conversation['messages'] = messages
    return conversation

def update_conversation_title(conversation_id, user_id, title):
    """Update conversation title"""
    query = "UPDATE conversations SET title = %s WHERE id = %s AND user_id = %s"
    execute_query(query, (title, conversation_id, user_id))

def delete_conversation(conversation_id, user_id):
    """Delete a conversation (cascade will delete messages)"""
    query = "DELETE FROM conversations WHERE id = %s AND user_id = %s"
    execute_query(query, (conversation_id, user_id))

# Message operations
def create_message(conversation_id, role, content):
    """Create a new message"""
    query = "INSERT INTO messages (conversation_id, role, content) VALUES (%s, %s, %s)"
    return execute_query(query, (conversation_id, role, content))

def get_messages_by_conversation(conversation_id):
    """Get all messages for a conversation"""
    query = "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at ASC"
    return execute_query(query, (conversation_id,), fetch_all=True)
