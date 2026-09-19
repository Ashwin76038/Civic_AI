import sys, unittest
from pathlib import Path
from unittest.mock import MagicMock,patch
from bson import ObjectId
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import app
class AuthTests(unittest.TestCase):
 def setUp(self):
  self.client=app.app.test_client();self.user={'_id':ObjectId(),'role':'user','name':'Demo','email':'demo@example.invalid'}
 def headers(self):return {'Authorization':'Bearer '+app.serializer.dumps({'id':str(self.user['_id'])})}
 def test_protected_routes(self):
  for path,method in [('/complaints','get'),('/reports','post'),('/complaints/'+str(ObjectId()),'delete'),('/uploads/demo.jpg','get')]:
   self.assertEqual(getattr(self.client,method)(path).status_code,401)
 def test_user_cannot_update_or_delete(self):
  with patch.object(app,'users_collection') as users:
   users.find_one.return_value=self.user
   self.assertEqual(self.client.delete('/complaints/'+str(ObjectId()),headers=self.headers()).status_code,403)
   self.assertEqual(self.client.patch('/complaints/'+str(ObjectId()),headers=self.headers(),json={'status':'Resolved'}).status_code,403)
 def test_registration_ignores_role(self):
  with patch.object(app,'users_collection') as users:
   users.find_one.return_value=None
   response=self.client.post('/register',json={'name':'Demo','email':'demo@example.invalid','password':'long-test-password','role':'admin'})
   self.assertEqual(response.status_code,201);self.assertEqual(users.insert_one.call_args.args[0]['role'],'user')
 def test_reads_scope_owner(self):
  with patch.object(app,'users_collection') as users,patch.object(app,'reports_collection') as reports:
   users.find_one.return_value=self.user;reports.find.return_value.sort.return_value.limit.return_value=[]
   self.assertEqual(self.client.get('/complaints',headers=self.headers()).status_code,200)
   reports.find.assert_called_once_with({'owner_id':str(self.user['_id'])})
 def test_debug_endpoints_absent(self):
  self.assertEqual(self.client.get('/test-admin').status_code,404);self.assertEqual(self.client.post('/reset-admin').status_code,404)
 def test_submission_without_model(self):
  import io,tempfile
  from PIL import Image
  blob=io.BytesIO();Image.new('RGB',(2,2)).save(blob,format='PNG');blob.seek(0)
  with tempfile.TemporaryDirectory() as tmp,patch.object(app,'UPLOAD_FOLDER',Path(tmp)),patch.object(app,'users_collection') as users,patch.object(app,'reports_collection') as reports:
   users.find_one.return_value=self.user;reports.insert_one.return_value.inserted_id=ObjectId()
   response=self.client.post('/reports',headers=self.headers(),data={'type':'pothole','location':'13.1,80.2','image':(blob,'demo.png')})
   self.assertEqual(response.status_code,201)
   record=reports.insert_one.call_args.args[0]
   self.assertEqual(record['owner_id'],str(self.user['_id']))
   self.assertEqual(record['location']['latitude'],13.1)
   self.assertEqual(len(list(Path(tmp).glob('*.jpg'))),1)
 def test_invalid_and_untrusted_requests(self):
  self.assertEqual(self.client.post('/login',json=[]).status_code,400)
  self.assertEqual(self.client.post('/login',json={},headers={'Origin':'https://untrusted.example'}).status_code,403)
if __name__=='__main__':unittest.main()
