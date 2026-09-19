"""Local civic-report prototype with server-enforced access control."""
from pathlib import Path
from datetime import datetime, timezone
from functools import wraps
import io, math, os, secrets, uuid
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import HTTPException
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from pymongo import MongoClient
from bson import ObjectId
from PIL import Image, UnidentifiedImageError
from dotenv import load_dotenv
load_dotenv()
app=Flask(__name__)
app.config['MAX_CONTENT_LENGTH']=8*1024*1024
origins=['http://localhost:5173','http://127.0.0.1:5173','http://localhost:3000']
CORS(app,origins=origins,supports_credentials=True)
serializer=URLSafeTimedSerializer(os.getenv('SECRET_KEY') or secrets.token_hex(32),salt='civic-session')
client=MongoClient(os.getenv('MONGO_URI','mongodb://localhost:27017/'),serverSelectionTimeoutMS=1500,connect=False)
db=client.civic
users_collection=db.users
reports_collection=db.issues
UPLOAD_FOLDER=Path(__file__).resolve().parent/'uploads'
UPLOAD_FOLDER.mkdir(exist_ok=True)
app.config['UPLOAD_FOLDER']=str(UPLOAD_FOLDER)

def now(): return datetime.now(timezone.utc)
def auth(admin=False):
 def decorator(fn):
  @wraps(fn)
  def wrapped(*args,**kwargs):
   header=request.headers.get('Authorization','')
   token=header[7:] if header.startswith('Bearer ') else request.cookies.get('civic_session','')
   try:
    payload=serializer.loads(token,max_age=3600)
    if not ObjectId.is_valid(payload.get('id','')): raise BadSignature('invalid identity')
    user=users_collection.find_one({'_id':ObjectId(payload['id'])})
    if not user: return jsonify(error='Authentication required'),401
   except (BadSignature,SignatureExpired): return jsonify(error='Authentication required'),401
   if admin and user.get('role')!='admin': return jsonify(error='Administrator access required'),403
   g.user=user
   return fn(*args,**kwargs)
  return wrapped
 return decorator

def scope(): return {} if g.user.get('role')=='admin' else {'owner_id':str(g.user['_id'])}
def public_report(report):
 report=dict(report);report['_id']=str(report['_id']);report.pop('owner_id',None)
 return report

@app.before_request
def validate_origin_and_json():
 if request.method in {'POST','PATCH','DELETE','PUT'}:
  origin=request.headers.get('Origin')
  if origin and origin not in origins: return jsonify(error='Origin not allowed'),403
 if request.is_json and not isinstance(request.get_json(silent=True),dict): return jsonify(error='Expected JSON object'),400

@app.errorhandler(Exception)
def safe_error(exc):
 if isinstance(exc,HTTPException):return jsonify(error=exc.name),exc.code
 app.logger.error('Request failed: %s',type(exc).__name__)
 return jsonify(error='Service unavailable; check local configuration'),503

@app.post('/register')
def register():
 data=request.get_json(silent=True) or {}
 name,email,password=(data.get(k,'') for k in ['name','email','password'])
 if not all(isinstance(v,str) for v in [name,email,password]) or not name.strip() or '@' not in email or not 12<=len(password)<=128: return jsonify(error='Name, email and a 12-128 character password are required'),400
 email=email.strip().lower()
 if users_collection.find_one({'email':email}):return jsonify(error='Account already exists'),409
 # Client-supplied roles are deliberately ignored. Provision admins locally.
 user={'name':name.strip()[:100],'email':email,'password':generate_password_hash(password),'neighborhood':str(data.get('neighborhood',''))[:100],'role':'user','created_at':now()}
 users_collection.insert_one(user)
 return jsonify(success=True,message='User registered'),201

@app.post('/login')
def login():
 data=request.get_json(silent=True) or {};email=data.get('email');password=data.get('password')
 if not isinstance(email,str) or not isinstance(password,str):return jsonify(error='Email and password required'),400
 user=users_collection.find_one({'email':email.strip().lower()})
 if not user or not check_password_hash(user.get('password',''),password):return jsonify(success=False,message='Invalid email or password'),401
 token=serializer.dumps({'id':str(user['_id'])})
 response=jsonify(success=True,token=token,role=user.get('role','user'),user={'id':str(user['_id']),'name':user['name'],'email':user['email'],'role':user.get('role','user')})
 response.set_cookie('civic_session',token,httponly=True,samesite='Strict',max_age=3600,secure=os.getenv('COOKIE_SECURE','false')=='true')
 return response

@app.post('/logout')
def logout():
 response=jsonify(message='Signed out');response.delete_cookie('civic_session');return response

@app.post('/reports')
@auth()
def submit_report():
 image=request.files.get('image');kind=request.form.get('type')
 if not image or kind not in {'drainage','pothole','garbage_waste'}:return jsonify(error='Supported issue type and image required'),400
 try:
  lat,lng=map(float,request.form.get('location','').split(','))
  if not math.isfinite(lat) or not math.isfinite(lng) or not -90<=lat<=90 or not -180<=lng<=180:raise ValueError()
 except (ValueError,TypeError):return jsonify(error='Invalid latitude/longitude'),400
 try:
  blob=image.read()
  with Image.open(io.BytesIO(blob)) as check:
   if check.format not in {'JPEG','PNG'} or check.width*check.height>16000000:raise ValueError()
   check.verify()
  name=uuid.uuid4().hex+'.jpg';path=UPLOAD_FOLDER/name
  with Image.open(io.BytesIO(blob)) as source:source.convert('RGB').save(path,format='JPEG',quality=90)
 except (UnidentifiedImageError,ValueError,OSError,Image.DecompressionBombError):return jsonify(error='Use a valid JPEG/PNG up to 16 megapixels'),400
 report={'owner_id':str(g.user['_id']),'type':kind,'title':kind.replace('_',' ').title(),'description':request.form.get('description','')[:2000],'status':'Open','image_filename':name,'imageUrl':'/uploads/'+name,'location':{'latitude':lat,'longitude':lng,'address':''},'created_at':now(),'submitted_at':now()}
 try:result=reports_collection.insert_one(report)
 except Exception:
  path.unlink(missing_ok=True);raise
 return jsonify(message='Report submitted',id=str(result.inserted_id)),201

@app.get('/complaints')
@auth()
def complaints():return jsonify([public_report(r) for r in reports_collection.find(scope()).sort('submitted_at',-1).limit(500)])

@app.get('/complaints/<report_id>')
@auth()
def complaint(report_id):
 if not ObjectId.is_valid(report_id):return jsonify(error='Invalid report ID'),400
 report=reports_collection.find_one({'_id':ObjectId(report_id),**scope()})
 return (jsonify(public_report(report)),200) if report else (jsonify(error='Report not found'),404)

@app.patch('/complaints/<report_id>')
@auth(admin=True)
def update_report(report_id):
 if not ObjectId.is_valid(report_id):return jsonify(error='Invalid report ID'),400
 data=request.get_json(silent=True) or {};status=data.get('status')
 if status not in {'Open','In Progress','Resolved'}:return jsonify(error='Supported status required'),400
 update={'status':status,'updated_at':now()}
 for field,limit in [('title',100),('description',2000)]:
  if field in data:
   if not isinstance(data[field],str):return jsonify(error='Text fields required'),400
   update[field]=data[field][:limit]
 result=reports_collection.update_one({'_id':ObjectId(report_id)},{'$set':update})
 return (jsonify(message='Report updated'),200) if result.matched_count else (jsonify(error='Report not found'),404)

@app.delete('/complaints/<report_id>')
@auth(admin=True)
def delete_report(report_id):
 if not ObjectId.is_valid(report_id):return jsonify(error='Invalid report ID'),400
 report=reports_collection.find_one({'_id':ObjectId(report_id)})
 if not report:return jsonify(error='Report not found'),404
 reports_collection.delete_one({'_id':ObjectId(report_id)})
 name=report.get('image_filename','')
 if name and Path(name).name==name:
  path=(UPLOAD_FOLDER/name).resolve()
  if path.parent==UPLOAD_FOLDER.resolve():path.unlink(missing_ok=True)
 return jsonify(message='Report deleted')

@app.get('/uploads/<filename>')
@auth()
def uploaded_file(filename):
 if not reports_collection.find_one({'image_filename':filename,**scope()}):return jsonify(error='Image not found'),404
 return send_from_directory(app.config['UPLOAD_FOLDER'],filename)

@app.get('/health')
def health():
 client.admin.command('ping');return jsonify(status='healthy')

if __name__=='__main__':app.run(host='127.0.0.1',port=5000,debug=False)
