from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import backup

app = FastAPI(title="Backup & Recovery API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
