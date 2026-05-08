from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import query

app = FastAPI(title="Query Processing API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(query.router, prefix="/api/query", tags=["Query"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
