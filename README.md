# Civic Issue Reporter

A local prototype for submitting image/location reports and reviewing municipal issue queues.

## Implemented

- React/TypeScript reporting and tracking views; Flask/MongoDB report storage.
- Hashed passwords and expiring signed sessions validated on the server.
- Account-scoped report/image reads; administrator-only status changes and deletion.
- Bounded JPEG/PNG uploads, coordinate validation and image re-encoding that drops source metadata.
- Separate image-classification source using MobileNet V2 binary classifiers for drainage, potholes and garbage/waste.

The classifier weights are absent from this repository. Training code and a train/validation image set exist, but no held-out accuracy or calibrated probability evidence supports production claims. Image classification is optional research code and is not a verified municipal severity assessment.

## Business use

Structured issue types, locations, submission dates and statuses can support queue monitoring and maintenance planning. No observed reduction in resolution time or operational deployment is claimed. The separate Civic BI repository is a supporting dataset study; an automatic integration is not implemented here.

## Local setup

```bash
python -m pip install -r requirements-api.txt
# Copy .env.example to .env and configure a private random SECRET_KEY.
# Start a local MongoDB instance.
python app.py
npm ci
npm run dev
```

API: localhost:5000. Frontend: Vite's configured localhost port. Register a user with a password of at least 12 characters. Admins must be provisioned locally in MongoDB by changing a reviewed user's role to `admin`; public registration never accepts an admin role. No default administrator/password is created. Existing unowned reports are visible only to admins until ownership is reconciled.

Optional model service: install `requirements.txt` plus `opencv-python`, provide independently evaluated category model weights and run `python models/model.py` (port 5001). Ordinary image/location report submission does not require a model scan. The optional scan workflow requires those weights. CRUD routes are served exclusively by the main authenticated API.

## Configuration and privacy

`.env.example` lists MongoDB, signing-secret and frontend API/maps settings. The Maps browser key must be restricted to approved referrers/APIs. A previously embedded key was removed; its owner must revoke or restrict it because Git history retains old values. Do not use real citizen data in public demonstrations. Images and precise locations are access-controlled private records, not portfolio assets.

## Validation and limitations

Use `python -m unittest discover -s tests -v` and `npm run build`. API authorization tests use isolated fakes, not a live production database. End-to-end MongoDB, maps and classifier operation require local services/credentials and model artifacts.

This remains a local prototype. Production work includes rate limiting, uniqueness enforcement for concurrent signup, session revocation, HTTPS/secure cookies, operational monitoring, dataset licensing review and independent model evaluation. Never infer security from a React route guard or a model prompt.

## Skills

API validation, data collection design, access control, Python, React/TypeScript and experimental computer vision. Core analyst portfolio positioning remains SQL, Power BI, Excel and Python.
