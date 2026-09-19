from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms
from torchvision.models import MobileNet_V2_Weights
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import json_util
import json
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

# Enhanced CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173", 
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:4173",
            "http://127.0.0.1:4173"
        ],
        "methods": ["GET", "POST", "OPTIONS", "HEAD"],
        "allow_headers": [
            "Content-Type", 
            "Authorization", 
            "X-Requested-With",
            "Accept",
            "Origin",
            "Cache-Control"
        ],
        "expose_headers": ["Content-Type", "Authorization"],
        "max_age": 600
    }
}, supports_credentials=True)

# Load environment variables
load_dotenv()

# MongoDB Atlas connection - FIXED to match app.py
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
try:
    if "localhost" in MONGO_URI:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    else:
        client = MongoClient(MONGO_URI, tls=True, tlsAllowInvalidCertificates=False)
    client.admin.command("ping")
    print("✅ MongoDB connection successful in model.py!")
    
    # FIXED: Use same approach as app.py
    db = client.civic  # Direct access to civic database
    issues_collection = db.issues  # Direct access to issues collection
except Exception as e:
    print(f"❌ MongoDB connection failed in model.py: {e}")
    client = db = issues_collection = None

# Define model categories
categories = ["drainage", "pothole", "garbage_waste"]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Create the binary model for each category
def create_binary_model():
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.features[-2:].parameters():
        param.requires_grad = True
    model.classifier = nn.Sequential(
        nn.Linear(1280, 512),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(512, 2)
    )
    return model.to(device)

# Initialize category models
category_models = {}
base_dir = os.path.dirname(os.path.abspath(__file__))
for category in categories:
    model = create_binary_model()
    model_path = os.path.join(base_dir, f"{category}_model.pth")
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        category_models[category] = model
        logger.info(f"Loaded model for {category} from {model_path}")
    else:
        logger.error(f"Warning: Model file {model_path} not found. Ensure models are trained and available.")

# Image preprocessing transform
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Add explicit OPTIONS handler for all routes
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

# Add request logging
@app.before_request
def log_request_info():
    logger.info(f"Request: {request.method} {request.url}")
    if request.method == "POST":
        logger.info(f"Form data: {dict(request.form)}")
        logger.info(f"Files: {list(request.files.keys())}")

@app.route('/')
def home():
    return jsonify({
        "service": "Civic AI Model Server",
        "status": "running",
        "version": "2.0.0",
        "endpoints": ["/predict", "/health", "/reports", "/complaints", "/model-info"],
        "supported_categories": categories,
        "models_loaded": len(category_models),
        "device": str(device),
        "database_connected": issues_collection is not None,
        "server_time": datetime.utcnow().isoformat()
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for React app connection verification"""
    logger.info("Health check endpoint accessed")
    response_data = {
        "status": "healthy",
        "service": "AI Model Server",
        "port": 5001,
        "timestamp": datetime.utcnow().isoformat(),
        "models_loaded": len(category_models),
        "available_categories": list(category_models.keys()),
        "device": str(device),
        "memory_usage": "Normal",
        "cors_enabled": True,
        "endpoints_available": True,
        "database_connected": issues_collection is not None,
        "database_name": "civic",
        "collection_name": "issues"
    }
    logger.info(f"Health check response: {response_data}")
    return jsonify(response_data), 200

@app.route('/predict', methods=['POST'])
def predict():
    try:
        logger.info(f"AI Prediction endpoint hit at {datetime.utcnow()}")
        
        if 'image' not in request.files or 'category' not in request.form:
            logger.error("Missing image or category in request")
            return jsonify({'error': 'Image and category are required'}), 400

        image_file = request.files['image']
        category = request.form['category']
        
        if category not in categories:
            logger.error(f"Invalid category: {category}")
            return jsonify({'error': f'Invalid category. Must be one of: {", ".join(categories)}'}), 400

        # Check if model is loaded
        model = category_models.get(category)
        if not model:
            logger.error(f"Model for {category} not loaded")
            return jsonify({'error': f'Model for {category} not available'}), 500

        upload_dir = os.path.join(base_dir, 'temp_uploads')
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, f"temp_{datetime.utcnow().timestamp()}_{image_file.filename}")
        image_file.save(image_path)
        logger.info(f"Saved temporary image to {image_path}")

        # Read and preprocess
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Failed to load image")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_tensor = transform(img).unsqueeze(0).to(device)

        model.eval()
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = torch.softmax(outputs, dim=1)
            probability = probs[0][1].item()
            is_match = probability >= 0.7

            result = {
                'is_match': is_match, 
                'probability': round(probability, 3),
                'category': category,
                'confidence_level': 'high' if probability > 0.8 else 'medium' if probability > 0.6 else 'low',
                'analysis_timestamp': datetime.utcnow().isoformat()
            }
            
            if is_match:
                if probability >= 0.9:
                    result['severity'] = 'high'
                elif probability >= 0.8:
                    result['severity'] = 'medium'
                else:
                    result['severity'] = 'low'
            
            # Add file info
            result["file_info"] = {
                "filename": image_file.filename,
                "content_type": image_file.content_type
            }

        logger.info(f"AI Analysis result: {result}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500

    finally:
        if 'image_path' in locals() and os.path.exists(image_path):
            os.remove(image_path)
            logger.info(f"Removed temporary file {image_path}")

@app.route('/model-info', methods=['GET'])
def model_info():
    """Detailed model information endpoint"""
    return jsonify({
        "model_name": "Civic Issue Classifier (Real AI)",
        "version": "2.0.0",
        "supported_categories": categories,
        "models_loaded": list(category_models.keys()),
        "device": str(device),
        "framework": "PyTorch",
        "architecture": "MobileNetV2",
        "description": "Real AI models for classifying civic infrastructure issues from images",
        "model_files_required": [f"{cat}_model.pth" for cat in categories],
        "performance": {
            "confidence_threshold": 0.7,
            "supported_formats": ["jpg", "png", "jpeg", "gif", "bmp", "webp"],
            "image_size": "224x224"
        },
        "database": {
            "connected": issues_collection is not None,
            "type": "MongoDB Atlas",
            "database_name": "civic",
            "collection_name": "issues"
        }
    })

@app.route('/test-connection', methods=['GET'])
def test_connection():
    """Test database connection"""
    try:
        if issues_collection is None:
            return jsonify({
                "status": "error",
                "message": "Database not connected"
            }), 503
        
        # Test database connection
        client.admin.command("ping")
        count = issues_collection.count_documents({})
        
        return jsonify({
            "status": "success",
            "message": "Database connection successful",
            "database": "civic",
            "collection": "issues",
            "document_count": count
        }), 200
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Database connection failed: {str(e)}"
        }), 503

# Add after_request handler to ensure CORS headers are always present
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Cache-Control')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Error handlers
@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404 error: {request.url}")
    return jsonify({
        "error": "Endpoint not found",
        "available_endpoints": ["/", "/predict", "/health", "/reports", "/complaints", "/model-info", "/test-connection"],
        "note": "Data endpoints (/reports, /complaints) are handled by main app server on port 5000",
        "timestamp": datetime.utcnow().isoformat()
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    logger.warning(f"405 error: {request.method} {request.url}")
    return jsonify({
        "error": "Method not allowed",
        "allowed_methods": ["GET", "POST", "OPTIONS"],
        "timestamp": datetime.utcnow().isoformat()
    }), 405

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 error: {error}")
    return jsonify({
        "error": "Internal server error",
        "message": "Something went wrong on our end",
        "timestamp": datetime.utcnow().isoformat()
    }), 500

if __name__ == '__main__':
    print("🤖 Starting Civic AI Model Server...")
    print(f"🎯 Supported categories: {', '.join(categories)}")
    print(f"🧠 Models loaded: {len(category_models)}/{len(categories)}")
    print(f"💻 Device: {device}")
    print("🌐 CORS enabled for frontend applications")
    print("📡 Server running at: http://localhost:5001")
    print("🔧 Endpoints: /, /predict, /health, /reports, /complaints, /model-info, /test-connection")
    print("🔍 Real AI models for image classification")
    print("📊 Enhanced logging enabled")
    print("🔒 CORS configured for multiple origins")
    print("🗃️ Database: civic | Collection: issues")
    print("📝 Note: Data operations handled by main app server on port 5000")
    
    if not category_models:
        logger.error("⚠️ No models loaded. Please ensure model files are present.")
        print("⚠️ Warning: No AI models loaded! Please ensure .pth model files are in the same directory.")
    else:
        logger.info("✅ All models loaded successfully. Starting server...")
        print("✅ All AI models loaded successfully!")
    
    app.run(debug=False, host='localhost', port=5001)