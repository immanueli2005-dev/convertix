import os
import uuid
import sqlite3
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from werkzeug.utils import secure_filename
from PIL import Image

# Initialize the Blueprint
converter_bp = Blueprint('converter', __name__)

# Supported formats configuration
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    """Checks if a file extension is in the allowed list."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ===================================================
# 1. API: POST /upload
# ===================================================
@converter_bp.route('/upload', methods=['POST'])
def upload_files():
    """
    Accepts single or multiple file uploads, validates extension constraints,
    prevents duplicate names by prefixing UUID, and saves to uploads folder.
    """
    if 'files' not in request.files:
        return jsonify({'success': False, 'error': 'No file part in the request'}), 400

    files = request.files.getlist('files')
    
    if not files or files[0].filename == '':
        return jsonify({'success': False, 'error': 'No files selected for upload'}), 400

    uploaded_metadata = []
    
    for file in files:
        if not file:
            continue

        if not allowed_file(file.filename):
            return jsonify({
                'success': False, 
                'error': f"File '{file.filename}' is of an unsupported format."
            }), 400

        # Sanitize original filename
        original_name = secure_filename(file.filename)
        
        # Generate a unique prefix filename using UUID to prevent duplication collisions
        unique_prefix = uuid.uuid4().hex
        stored_filename = f"{unique_prefix}_{original_name}"
        
        # Save path inside config UPLOAD_FOLDER
        save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], stored_filename)
        
        # Save file to disk
        file.save(save_path)
        
        # Retrieve size on disk
        file_size = os.path.getsize(save_path)
        
        # Extract source format extension
        source_ext = original_name.rsplit('.', 1)[1].lower()

        uploaded_metadata.append({
            'id': stored_filename,
            'original_name': original_name,
            'size': file_size,
            'format': source_ext
        })

    return jsonify({
        'success': True,
        'files': uploaded_metadata
    })

# ===================================================
# 2. API: POST /convert
# ===================================================
@converter_bp.route('/convert', methods=['POST'])
def convert_files():
    """
    Accepts a list of files to convert, performs image formatting
    using the Pillow library, writes record into sqlite db, and returns links.
    """
    data = request.get_json()
    if not data or 'files' not in data:
        return jsonify({'success': False, 'error': 'Invalid payload data'}), 400

    user_id = data.get('user_id', 'guest')
    conversion_targets = data['files']
    results = []

    for item in conversion_targets:
        file_id = item.get('id')
        target_ext = item.get('target', '').lower()

        if not file_id or not target_ext:
            continue

        if target_ext not in ALLOWED_EXTENSIONS:
            return jsonify({'success': False, 'error': f"Target extension '{target_ext}' not supported."}), 400

        # Construct file input path
        input_path = os.path.join(current_app.config['UPLOAD_FOLDER'], file_id)
        if not os.path.exists(input_path):
            return jsonify({'success': False, 'error': f"Source file '{file_id}' not found."}), 404

        # Generate original name and root name
        # file_id format: uuid_original.ext
        raw_original_name = file_id.split('_', 1)[1] if '_' in file_id else file_id
        original_root_name = raw_original_name.rsplit('.', 1)[0]
        
        # Generate new converted output filename
        converted_filename = f"converted_{uuid.uuid4().hex}_{original_root_name}.{target_ext}"
        output_path = os.path.join(current_app.config['CONVERTED_FOLDER'], converted_filename)

        try:
            # Pillow image formatting engine
            img = Image.open(input_path)
            
            # Format route maps
            if target_ext in ('jpg', 'jpeg'):
                # Fill background white for RGBA transparent images
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                else:
                    img = img.convert('RGB')
                
                img.save(output_path, 'JPEG', quality=90)
            elif target_ext == 'png':
                img.save(output_path, 'PNG')
            elif target_ext == 'webp':
                img.save(output_path, 'WEBP')
            else:
                img.save(output_path, target_ext.upper())

            # Formatting file size helper for DB logging
            converted_size_bytes = os.path.getsize(output_path)
            file_size_display = format_bytes(converted_size_bytes)
            
            # Extract source extension
            source_ext = raw_original_name.rsplit('.', 1)[1].lower()

            # Save conversion log into sqlite database
            db_conn = sqlite3.connect(current_app.config['DATABASE_FILE'])
            db_cursor = db_conn.cursor()
            db_cursor.execute('''
                INSERT INTO conversions (id, user_id, original_filename, original_format, converted_format, file_size, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                converted_filename,
                user_id,
                raw_original_name,
                source_ext.upper(),
                target_ext.upper(),
                file_size_display,
                datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            ))
            db_conn.commit()
            db_conn.close()

            # Record success result metadata
            results.append({
                'id': file_id,
                'status': 'completed',
                'download_url': f"/download/{converted_filename}",
                'new_name': f"{original_root_name}_converted.{target_ext}"
            })

        except Exception as err:
            print(f"[CONVERSION ERROR] Failed converting {file_id}: {err}")
            results.append({
                'id': file_id,
                'status': 'error',
                'error_msg': str(err)
            })

    return jsonify({
        'success': True,
        'results': results
    })

# ===================================================
# 3. API: GET /download/<filename>
# ===================================================
@converter_bp.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Serves a converted image file to the client for downloading."""
    # Sanitize download filename pattern to prevent folder traversal
    clean_name = secure_filename(filename)
    return send_from_directory(
        current_app.config['CONVERTED_FOLDER'], 
        clean_name,
        as_attachment=True
    )

# ===================================================
# 4. API: GET /history
# ===================================================
@converter_bp.route('/history', methods=['GET'])
def get_history():
    """Queries SQLite database to return conversion history for a user."""
    user_id = request.args.get('user_id', 'guest')
    
    try:
        db_conn = sqlite3.connect(current_app.config['DATABASE_FILE'])
        db_conn.row_factory = sqlite3.Row  # Enables column access by dictionary name
        db_cursor = db_conn.cursor()
        
        db_cursor.execute('''
            SELECT id, original_filename, original_format, converted_format, file_size, timestamp
            FROM conversions
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 50
        ''', (user_id,))
        
        rows = db_cursor.fetchall()
        db_conn.close()

        history_list = []
        for r in rows:
            history_list.append({
                'id': r['id'],
                'filename': r['original_filename'],
                'size': r['file_size'],
                'source': r['original_format'],
                'target': r['converted_format'],
                'timestamp': r['timestamp']
            })

        return jsonify(history_list)

    except Exception as err:
        return jsonify({'success': False, 'error': f"Database query failed: {err}"}), 500

# ===================================================
# 5. API: POST /download-zip
# ===================================================
@converter_bp.route('/download-zip', methods=['POST'])
def download_zip():
    """
    Accepts a list of converted filenames, bundles them into a single ZIP file
    using Python's built-in zipfile library, and returns the download link.
    """
    import zipfile
    data = request.get_json()
    if not data or 'files' not in data:
        return jsonify({'success': False, 'error': 'Missing files list'}), 400
        
    file_names = data['files']
    if not file_names:
        return jsonify({'success': False, 'error': 'No files to zip'}), 400
        
    zip_filename = f"convertix_batch_{uuid.uuid4().hex}.zip"
    zip_path = os.path.join(current_app.config['CONVERTED_FOLDER'], zip_filename)
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for fname in file_names:
                clean_fname = secure_filename(fname)
                file_path = os.path.join(current_app.config['CONVERTED_FOLDER'], clean_fname)
                if os.path.exists(file_path):
                    # Clean filename to strip conversion tags inside the archive
                    # e.g., converted_uuid_photo.jpg -> photo_converted.jpg
                    archive_name = clean_fname.split('_', 2)[-1] if clean_fname.startswith('converted_') else clean_fname
                    zipf.write(file_path, arcname=archive_name)
        
        return jsonify({
            'success': True,
            'download_url': f"/download/{zip_filename}",
            'zip_name': 'convertix_converted_files.zip'
        })
    except Exception as e:
        print(f"[ZIP ERROR] Failed to create zip: {e}")
        return jsonify({'success': False, 'error': f"Failed to create ZIP: {str(e)}"}), 500

# ===================================================
# Helpers
# ===================================================
def format_bytes(bytes, decimals=2):
    """Formats raw bytes count into a human-readable display string."""
    if bytes == 0:
        return '0 Bytes'
    k = 1024
    dm = decimals if decimals >= 0 else 0
    sizes = ['Bytes', 'KB', 'MB', 'GB']
    
    # Calculate order index
    import math
    i = int(math.floor(math.log(bytes) / math.log(k)))
    return f"{round(bytes / (k ** i), dm)} {sizes[i]}"
