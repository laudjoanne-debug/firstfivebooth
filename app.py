import os
import re
import json
import base64
from datetime import datetime
from flask import Flask, render_template, send_from_directory, jsonify, request

app = Flask(__name__, template_folder='templates', static_folder='static')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
POSES_DIR = os.path.join(BASE_DIR, 'static', 'poses')
CAPTURED_DIR = os.path.join(BASE_DIR, 'captured')

os.makedirs(POSES_DIR, exist_ok=True)
os.makedirs(CAPTURED_DIR, exist_ok=True)

def load_poses_data():
    """Load all pose images and pair them with their JSON metadata if available."""
    valid_exts = ('.jpg', '.jpeg', '.png', '.webp')
    if not os.path.exists(POSES_DIR):
        return []
        
    files = sorted([f for f in os.listdir(POSES_DIR) if f.lower().endswith(valid_exts)])
    poses = []
    
    # Try master poses.json first if available
    master_path = os.path.join(POSES_DIR, 'poses.json')
    master_map = {}
    if os.path.exists(master_path):
        try:
            with open(master_path, 'r', encoding='utf-8') as f:
                items = json.load(f)
                for it in items:
                    master_map[it.get('image')] = it
        except Exception as e:
            print(f"Warning loading master poses.json: {e}")

    for filename in files:
        base_name = os.path.splitext(filename)[0]
        json_file = os.path.join(POSES_DIR, f"{base_name}.json")
        
        pose_data = {
            'image': filename,
            'title': 'Expressive Pose Challenge',
            'category': 'fun',
            'description': 'Strike this pose to match the character!',
            'keypoints': {
                'left_wrist': {'rel_x': -0.25, 'rel_y': -0.15},
                'right_wrist': {'rel_x': 0.25, 'rel_y': -0.15},
                'left_elbow': {'rel_x': -0.3, 'rel_y': 0.15},
                'right_elbow': {'rel_x': 0.3, 'rel_y': 0.15}
            },
            'rules': ['hands_chest_or_face']
        }
        
        if filename in master_map:
            pose_data.update(master_map[filename])
        elif os.path.exists(json_file):
            try:
                with open(json_file, 'r', encoding='utf-8') as jf:
                    custom = json.load(jf)
                    pose_data.update(custom)
            except Exception as e:
                print(f"Error reading {json_file}: {e}")
                
        poses.append(pose_data)
        
    return poses

@app.route('/')
def index():
    """Render the main photobooth application."""
    if os.path.exists(os.path.join(BASE_DIR, 'templates', 'index.html')):
        return render_template('index.html')
    elif os.path.exists(os.path.join(BASE_DIR, 'index.html')):
        return send_from_directory(BASE_DIR, 'index.html')
    return "index.html not found", 404

@app.route('/api/poses', methods=['GET'])
def get_poses():
    """Return all available character pose challenges."""
    poses = load_poses_data()
    return jsonify({
        'status': 'success',
        'count': len(poses),
        'poses': poses
    })

@app.route('/api/save', methods=['POST'])
def save_photo():
    """Save a captured image or collage to the captured/ folder."""
    data = request.get_json(silent=True) or {}
    image_data = data.get('image')
    file_type = data.get('type', 'collage') # 'collage' or 'photo'
    
    if not image_data:
        return jsonify({'status': 'error', 'message': 'No image data received'}), 400
        
    try:
        # Strip header if base64 data url
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
            
        binary = base64.b64decode(image_data)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"firstfivebooth_{file_type}_{timestamp}.png"
        filepath = os.path.join(CAPTURED_DIR, filename)
        
        with open(filepath, 'wb') as f:
            f.write(binary)
            
        return jsonify({
            'status': 'success',
            'filename': filename,
            'message': 'Saved successfully to captured folder'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.after_request
def add_header(response):
    """Disable cache for instant development updates."""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

if __name__ == '__main__':
    print("==================================================")
    print("  * FIRSTFIVEBOOTH - CHARACTER POSE PHOTOBOOTH *  ")
    print("  Server running at: http://127.0.0.1:5000         ")
    print("==================================================")
    app.run(host='0.0.0.0', port=5000, debug=True)

