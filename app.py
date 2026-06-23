import os
import time
import sqlite3
import threading
from flask import Flask, render_template

# Initialize Flask App
# Configuring templates/ and static/ directories explicitly
app = Flask(__name__, template_folder='templates', static_folder='static')

# Set Configuration Constants
UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads')
CONVERTED_FOLDER = os.path.join(app.root_path, 'converted')
DATABASE_FILE = os.path.join(app.root_path, 'convertix.db')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['CONVERTED_FOLDER'] = CONVERTED_FOLDER
app.config['DATABASE_FILE'] = DATABASE_FILE

# Set max file size limit to 10MB per file upload
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

# Ensure uploads and converted folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)

# ===================================================
# 1. SQLite Database Initialization
# ===================================================
def init_db():
    """Initializes the SQLite database and creates the history table."""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            original_format TEXT NOT NULL,
            converted_format TEXT NOT NULL,
            file_size TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

# Initialize the db schema
init_db()

# ===================================================
# 2. Background Task: Automatic File Deletion (1 Hour)
# ===================================================
def cleanup_expired_files():
    """
    Background daemon job that runs periodically to delete
    uploaded and converted files that are older than 1 hour (3600 seconds).
    """
    CLEANUP_INTERVAL_SECONDS = 600  # Sweep folders every 10 minutes
    EXPIRATION_THRESHOLD_SECONDS = 3600  # 1 hour expiration limit

    while True:
        try:
            current_time = time.time()
            folders_to_clean = [UPLOAD_FOLDER, CONVERTED_FOLDER]

            for folder in folders_to_clean:
                if not os.path.exists(folder):
                    continue

                for filename in os.listdir(folder):
                    file_path = os.path.join(folder, filename)
                    
                    # Skip subdirectories
                    if not os.path.isfile(file_path):
                        continue

                    # Retrieve file last modification timestamp
                    file_modified_time = os.path.getmtime(file_path)
                    file_age_seconds = current_time - file_modified_time

                    if file_age_seconds > EXPIRATION_THRESHOLD_SECONDS:
                        try:
                            os.remove(file_path)
                            print(f"[CLEANUP] Deleted expired file: {filename}")
                        except Exception as e:
                            print(f"[CLEANUP] Failed to delete file {filename}: {e}")

        except Exception as err:
            print(f"[CLEANUP ERROR] Sweep iteration failed: {err}")

        # Sleep before the next sweep iteration
        time.sleep(CLEANUP_INTERVAL_SECONDS)

# Launch cleanup daemon thread
cleanup_thread = threading.Thread(target=cleanup_expired_files, daemon=True)
cleanup_thread.start()

# ===================================================
# 3. Main Frontend Routing Views
# ===================================================
@app.route('/')
def home():
    """Renders the Home Page Converter layout."""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Renders the Conversion History dashboard."""
    return render_template('dashboard.html')

@app.route('/signin')
def signin():
    """Renders the Sign In authentication card."""
    return render_template('signin.html')

@app.route('/signup')
def signup():
    """Renders the Sign Up authentication card."""
    return render_template('signup.html')

# ===================================================
# 4. Blueprint Registrations
# ===================================================
from routes.converter import converter_bp
app.register_blueprint(converter_bp)

# Start App
if __name__ == '__main__':
    # Run server locally on port 8080
    app.run(host='127.0.0.1', port=8080, debug=True)
