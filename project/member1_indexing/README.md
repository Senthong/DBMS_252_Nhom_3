# member1_indexing

## Run locally
```bash
# Backend (port 8001)
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8001

# Frontend (port 3001)
cd frontend && npm install && npm run dev
```
Swagger UI: http://localhost:8001/docs
