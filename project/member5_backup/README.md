# member5_backup

## Run locally
```bash
# Backend (port 8005)
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8005

# Frontend (port 3005)
cd frontend && npm install && npm run dev
```
Swagger UI: http://localhost:8005/docs
