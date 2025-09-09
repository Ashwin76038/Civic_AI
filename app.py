from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson import ObjectId
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Load env
load_dotenv()

app = Flask(__name__)

# Enhanced CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173", 
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
    }
}, supports_credentials=True)

# MongoDB connection - FIXED DATABASE AND COLLECTION NAMES
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://localhost:27017/"

try:
    if "localhost" in MONGO_URI:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    else:
        client = MongoClient(MONGO_URI, tls=True, tlsAllowInvalidCertificates=False)
    client.admin.command("ping")
    print("✅ MongoDB connection successful!")

    # CHANGED: Use 'civic' database instead of 'civicai'
    db = client.civic if "localhost" in MONGO_URI else client.civic
    # CHANGED: Use 'issues' collection instead of 'reports'
    reports_collection = db.issues
    users_collection = db.users
except Exception as e:
    print(f"❌ MongoDB connection failed: {e}")
    client = db = reports_collection = users_collection = None

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

def check_db_connection():
    if client is None or db is None:
        return False, "Database connection not established"
    try:
        client.admin.command("ping")
        return True, "Database connected"
    except Exception as e:
        return False, f"Database connection error: {str(e)}"

# Bootstrap default admin
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

def ensure_default_admin():
    """Create or verify default admin user"""
    if users_collection is None or not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("❌ Cannot create admin: missing database or credentials")
        return
    
    # Check if admin exists
    admin_user = users_collection.find_one({"email": ADMIN_EMAIL})
    
    if admin_user:
        # Verify password works
        if check_password_hash(admin_user["password"], ADMIN_PASSWORD):
            print(f"✅ Admin user verified: {ADMIN_EMAIL}")
            return
        else:
            print(f"⚠️ Admin password mismatch, updating...")
            # Update password
            users_collection.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {
                    "password": generate_password_hash(ADMIN_PASSWORD),
                    "role": "admin",
                    "updated_at": datetime.utcnow()
                }}
            )
            print(f"✅ Admin password updated: {ADMIN_EMAIL}")
    else:
        # Create new admin
        hashed_password = generate_password_hash(ADMIN_PASSWORD)
        admin_doc = {
            "name": "System Admin",
            "email": ADMIN_EMAIL,
            "neighborhood": "Admin Area",
            "password": hashed_password,
            "role": "admin",
            "created_at": datetime.utcnow()
        }
        
        try:
            result = users_collection.insert_one(admin_doc)
            print(f"✅ Default admin created: {ADMIN_EMAIL} (ID: {result.inserted_id})")
            
            # Verify the creation worked
            test_user = users_collection.find_one({"email": ADMIN_EMAIL})
            if test_user and check_password_hash(test_user["password"], ADMIN_PASSWORD):
                print("✅ Admin password verification successful")
            else:
                print("❌ Admin password verification failed after creation!")
                
        except Exception as e:
            print(f"❌ Failed to create admin: {e}")

def debug_admin_user():
    """Debug function to check admin user in database"""
    if users_collection is None:
        print("❌ No database connection for admin debug")
        return
    
    admin_user = users_collection.find_one({"email": ADMIN_EMAIL})
    if admin_user:
        print(f"🔍 Admin user found in database:")
        print(f"   - Email: {admin_user['email']}")
        print(f"   - Role: {admin_user.get('role', 'No role set')}")
        print(f"   - Has password hash: {bool(admin_user.get('password'))}")
        
        # Test password verification
        if admin_user.get('password'):
            is_valid = check_password_hash(admin_user['password'], ADMIN_PASSWORD)
            print(f"   - Password check result: {is_valid}")
            
            if not is_valid:
                print("❌ Password verification failed! Recreating admin...")
                # Delete old admin and create new one
                users_collection.delete_one({"email": ADMIN_EMAIL})
                ensure_default_admin()
        else:
            print("❌ Admin has no password hash!")
    else:
        print(f"❌ No admin user found with email: {ADMIN_EMAIL}")

# Initialize admin
ensure_default_admin()
debug_admin_user()

# Serve uploaded images
@app.route("/uploads/<filename>")
def uploaded_file(filename):
    try:
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

@app.route("/")
def home():
    ok, msg = check_db_connection()
    return f"<h1>Civic AI Backend</h1><p>Database Status: {msg}</p>"

# Test routes (remove after fixing)
@app.route("/test-admin", methods=["GET"])
def test_admin():
    """Test route to verify admin user"""
    try:
        if users_collection is None:
            return jsonify({"error": "No database connection"}), 503
            
        admin_user = users_collection.find_one({"email": ADMIN_EMAIL})
        
        if not admin_user:
            return jsonify({
                "status": "no_admin",
                "message": f"No admin user found with email: {ADMIN_EMAIL}",
                "expected_email": ADMIN_EMAIL,
                "expected_password": ADMIN_PASSWORD
            }), 404
            
        # Test password
        password_valid = check_password_hash(admin_user["password"], ADMIN_PASSWORD)
        
        return jsonify({
            "status": "admin_found",
            "email": admin_user["email"],
            "role": admin_user.get("role", "no_role"),
            "password_valid": password_valid,
            "expected_password": ADMIN_PASSWORD,
            "has_password_hash": bool(admin_user.get("password")),
            "created_at": str(admin_user.get("created_at", "unknown"))
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/reset-admin", methods=["POST"])
def reset_admin():
    """Manually reset admin user"""
    try:
        if users_collection is None:
            return jsonify({"error": "No database connection"}), 503
            
        # Delete existing admin
        users_collection.delete_many({"email": ADMIN_EMAIL})
        
        # Create new admin
        admin_doc = {
            "name": "System Admin",
            "email": ADMIN_EMAIL,
            "neighborhood": "Admin Area",
            "password": generate_password_hash(ADMIN_PASSWORD),
            "role": "admin",
            "created_at": datetime.utcnow()
        }
        
        result = users_collection.insert_one(admin_doc)
        
        return jsonify({
            "message": "Admin reset successfully",
            "admin_id": str(result.inserted_id),
            "email": ADMIN_EMAIL
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Submit Report - Fixed location parsing
@app.route("/reports", methods=["POST", "OPTIONS"])
def submit_report():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            return jsonify({"error": f"Database unavailable: {msg}"}), 503

        image = request.files.get("image")
        issue_type = request.form.get("type")
        location_str = request.form.get("location")  # "lat,lng"
        description = request.form.get("description", "")
        ai_probability = request.form.get("ai_probability", "0")
        ai_severity = request.form.get("ai_severity", "")

        print(f"📝 Received report: type={issue_type}, location={location_str}")

        if not image or not issue_type or not location_str:
            return jsonify({"error": "Missing required fields"}), 400

        # Parse location string to object
        try:
            lat_str, lng_str = location_str.split(",")
            latitude = float(lat_str.strip())
            longitude = float(lng_str.strip())
        except (ValueError, AttributeError):
            return jsonify({"error": "Invalid location format"}), 400

        filename = secure_filename(image.filename)
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        image_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
        image.save(image_path)

        # Create report with proper structure - FIXED to match existing data
        report = {
            "type": issue_type,  # Keep as 'type' to match existing data
            "title": issue_type.replace("_", " ").title(),  # Also add title for React
            "description": description,
            "status": "Open",
            "ai_probability": float(ai_probability),
            "ai_severity": ai_severity,
            "image_filename": unique_filename,  # Keep original field name
            "imageUrl": f"/uploads/{unique_filename}",  # Also add imageUrl for React
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "address": ""  # Can be updated later with reverse geocoding
            },
            "submitted_at": datetime.utcnow(),  # Keep original field name
            "created_at": datetime.utcnow(),  # Also add for React compatibility
        }
        
        result = reports_collection.insert_one(report)
        print(f"✅ Report saved with ID: {result.inserted_id}")
        
        return jsonify({
            "message": "Report submitted successfully", 
            "id": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        print(f"❌ Error in submit_report: {e}")
        return jsonify({"error": f"Failed to submit report: {str(e)}"}), 500

# Get all complaints - UPDATED to handle existing data structure
@app.route("/complaints", methods=["GET", "OPTIONS"])
def get_reports():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            print(f"❌ Database not available: {msg}")
            return jsonify({"error": f"Database unavailable: {msg}"}), 503
            
        print("📋 Fetching all complaints...")
        reports = list(reports_collection.find().sort("submitted_at", -1))
        
        # Transform the data to match what React expects
        for report in reports:
            report["_id"] = str(report["_id"])
            
            # Add title if missing (use type as title)
            if "title" not in report and "type" in report:
                report["title"] = report["type"].replace("_", " ").title()
            
            # Convert image_filename to imageUrl if needed
            if "image_filename" in report and "imageUrl" not in report:
                report["imageUrl"] = f"/uploads/{report['image_filename']}"
            
            # Add status if missing
            if "status" not in report:
                report["status"] = "Open"
            
            # Use submitted_at as created_at if needed
            if "submitted_at" in report and "created_at" not in report:
                report["created_at"] = report["submitted_at"]
            
            # Ensure location has proper structure
            if "location" in report:
                if isinstance(report["location"], str):
                    # Convert old string format to object
                    try:
                        lat_str, lng_str = report["location"].split(",")
                        report["location"] = {
                            "latitude": float(lat_str.strip()),
                            "longitude": float(lng_str.strip()),
                            "address": ""
                        }
                    except:
                        report["location"] = {"latitude": None, "longitude": None, "address": ""}
            else:
                report["location"] = {"latitude": None, "longitude": None, "address": ""}
            
            # Ensure imageUrl is a proper URL
            if "imageUrl" in report and report["imageUrl"]:
                if not report["imageUrl"].startswith(("http://", "https://", "/")):
                    # Convert file path to URL path
                    filename = os.path.basename(report["imageUrl"])
                    report["imageUrl"] = f"/uploads/{filename}"
        
        print(f"✅ Found {len(reports)} complaints")
        return jsonify(reports), 200
        
    except Exception as e:
        print(f"❌ Error in get_reports: {e}")
        return jsonify({
            "error": f"Failed to fetch complaints: {str(e)}",
            "details": str(e)
        }), 500

# Get single complaint
@app.route("/complaints/<report_id>", methods=["GET", "OPTIONS"])
def get_report(report_id):
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            return jsonify({"error": f"Database unavailable: {msg}"}), 503
            
        report = reports_collection.find_one({"_id": ObjectId(report_id)})
        if not report:
            return jsonify({"error": "Report not found"}), 404
            
        report["_id"] = str(report["_id"])
        
        # Transform data for React compatibility
        if "title" not in report and "type" in report:
            report["title"] = report["type"].replace("_", " ").title()
        
        if "image_filename" in report and "imageUrl" not in report:
            report["imageUrl"] = f"/uploads/{report['image_filename']}"
        
        if "status" not in report:
            report["status"] = "Open"
        
        if "submitted_at" in report and "created_at" not in report:
            report["created_at"] = report["submitted_at"]
        
        # Fix location structure
        if "location" in report and isinstance(report["location"], str):
            try:
                lat_str, lng_str = report["location"].split(",")
                report["location"] = {
                    "latitude": float(lat_str.strip()),
                    "longitude": float(lng_str.strip()),
                    "address": ""
                }
            except:
                report["location"] = {"latitude": None, "longitude": None, "address": ""}
        
        return jsonify(report), 200
        
    except Exception as e:
        print(f"❌ Error in get_report: {e}")
        return jsonify({"error": str(e)}), 500

# Delete complaint
@app.route("/complaints/<report_id>", methods=["DELETE", "OPTIONS"])
def delete_report(report_id):
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            return jsonify({"error": f"Database unavailable: {msg}"}), 503
            
        # Get report first to delete associated image
        report = reports_collection.find_one({"_id": ObjectId(report_id)})
        
        result = reports_collection.delete_one({"_id": ObjectId(report_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Complaint not found"}), 404
            
        # Try to delete associated image file
        if report:
            # Handle both old and new image field names
            image_filename = report.get("image_filename") or report.get("imageUrl", "").replace("/uploads/", "")
            if image_filename:
                try:
                    file_path = os.path.join(app.config["UPLOAD_FOLDER"], image_filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"🗑️ Deleted image file: {image_filename}")
                except Exception as img_error:
                    print(f"⚠️ Could not delete image file: {img_error}")
        
        return jsonify({"message": "Complaint deleted successfully"}), 200
        
    except Exception as e:
        print(f"❌ Error in delete_report: {e}")
        return jsonify({"error": str(e)}), 500

# Update complaint
@app.route("/complaints/<report_id>", methods=["PATCH", "OPTIONS"])
def update_report(report_id):
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            return jsonify({"error": f"Database unavailable: {msg}"}), 503
            
        data = request.json or {}
        allowed = {"status", "title", "description", "location", "imageUrl", "type"}
        update = {k: v for k, v in data.items() if k in allowed}
        
        if not update:
            return jsonify({"error": "No valid fields to update"}), 400
            
        # Add updated timestamp
        update["updated_at"] = datetime.utcnow()
        
        res = reports_collection.update_one({"_id": ObjectId(report_id)}, {"$set": update})
        if res.matched_count == 0:
            return jsonify({"error": "Complaint not found"}), 404
            
        return jsonify({"message": "Complaint updated"}), 200
        
    except Exception as e:
        print(f"❌ Error in update_report: {e}")
        return jsonify({"error": str(e)}), 500

# Auth endpoints (keeping existing functionality)
@app.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response

    try:
        ok, msg = check_db_connection()
        if not ok:
            return jsonify({"error": f"Database unavailable: {msg}"}), 503

        data = request.json
        if not data:
            return jsonify({"error": "No JSON data received"}), 400

        name = data.get("name")
        email = data.get("email")
        neighborhood = data.get("neighborhood")
        password = data.get("password")

        print(f"📝 Register attempt: {email}")

        if not name or not email or not password:
            return jsonify({"error": "Missing required fields"}), 400

        if users_collection.find_one({"email": email}):
            return jsonify({"error": "User already exists"}), 409

        role = "user"
        if email == ADMIN_EMAIL:
            role = "admin"
        elif data.get("role") == "admin":
            role = "admin"

        user = {
            "name": name,
            "email": email,
            "neighborhood": neighborhood,
            "password": generate_password_hash(password),
            "role": role,
            "created_at": datetime.utcnow()
        }
        result = users_collection.insert_one(user)
        print(f"✅ User registered: {email}")

        return jsonify({"message": "User registered", "id": str(result.inserted_id)}), 201
    except Exception as e:
        print(f"❌ Error in register: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response
        
    try:
        print(f"🔐 Login endpoint hit!")
        
        # Debug: Print raw request data
        print(f"🔍 Request method: {request.method}")
        print(f"🔍 Content type: {request.content_type}")
        print(f"🔍 Raw data: {request.get_data()}")
        
        ok, msg = check_db_connection()
        if not ok:
            print(f"❌ Database not available: {msg}")
            return jsonify({
                "success": False,
                "message": f"Database unavailable: {msg}"
            }), 503

        data = request.json
        if not data:
            print("❌ No JSON data received")
            return jsonify({
                "success": False,
                "message": "No JSON data received"
            }), 400

        email = data.get("email")
        password = data.get("password")

        print(f"🔐 Login attempt: {email}")
        print(f"🔍 Password received: {'*' * len(password) if password else 'None'}")
        print(f"🔍 Expected email: {ADMIN_EMAIL}")
        print(f"🔍 Expected password: {ADMIN_PASSWORD}")

        if not email or not password:
            print("❌ Missing email or password")
            return jsonify({
                "success": False,
                "message": "Missing email or password"
            }), 400

        # Find user in database
        user = users_collection.find_one({"email": email})
        
        if not user:
            print(f"❌ User not found: {email}")
            return jsonify({
                "success": False,
                "message": "Invalid email or password"
            }), 401

        print(f"🔍 User found in DB: {user['email']}")
        print(f"🔍 User role: {user.get('role', 'no_role')}")
        print(f"🔍 User has password hash: {bool(user.get('password'))}")

        # Check password
        password_valid = check_password_hash(user["password"], password)
        print(f"🔍 Password verification result: {password_valid}")

        if password_valid:
            user_role = user.get("role", "user")
            token = str(uuid.uuid4())
            
            print(f"✅ Login successful: {email} - Role: {user_role}")
            
            return jsonify({
                "success": True,
                "token": token,
                "role": user_role,
                "message": "Login successful",
                "user": {
                    "id": str(user["_id"]),
                    "name": user["name"],
                    "email": user["email"],
                    "neighborhood": user.get("neighborhood", ""),
                    "role": user_role,
                }
            }), 200

        print(f"❌ Password verification failed for: {email}")
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401
        
    except Exception as e:
        print(f"❌ Error in login: {e}")
        return jsonify({
            "success": False,
            "message": f"Login error: {str(e)}"
        }), 500

@app.route("/health", methods=["GET"])
def health_check():
    ok, msg = check_db_connection()
    return jsonify({
        "status": "healthy" if ok else "unhealthy",
        "database": msg,
        "service": "Main Backend",
        "port": 5000,
        "timestamp": datetime.utcnow().isoformat()
    }), 200 if ok else 503

@app.route("/test", methods=["GET", "POST", "OPTIONS"])
def test_cors():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
        return response
    
    return jsonify({
        "message": "CORS test successful",
        "method": request.method,
        "origin": request.headers.get("Origin", "No origin header"),
        "user_agent": request.headers.get("User-Agent", "No user agent"),
        "timestamp": datetime.utcnow().isoformat()
    })

if __name__ == "__main__":
    print("🚀 Starting Flask server...")
    print(f"📧 Admin email: {ADMIN_EMAIL}")
    print(f"🔐 Admin password: {ADMIN_PASSWORD}")
    print("🌐 CORS enabled for:")
    print("   - http://localhost:5173")
    print("   - http://127.0.0.1:5173")
    print("   - http://localhost:3000")
    print("   - http://127.0.0.1:3000")
    print("🎯 Routes available:")
    print("   - GET  /complaints (fetch all)")
    print("   - GET  /complaints/<id> (fetch one)")
    print("   - DELETE /complaints/<id> (delete)")
    print("   - PATCH /complaints/<id> (update)")
    print("   - POST /login")
    print("   - POST /register")
    print("   - POST /reports (submit new)")
    print("   - GET  /uploads/<filename> (serve images)")
    print("   - GET  /test-admin (debug admin)")
    print("   - POST /reset-admin (reset admin)")
    print("⚠️  AI /predict route handled by model.py:8001")
    print("📊 Database: civic | Collection: issues")
    app.run(host="0.0.0.0", port=5000, debug=True)