from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import indexing, orders

app = FastAPI(title="Indexing API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(indexing.router, prefix="/api/indexing", tags=["Indexing"])
app.include_router(orders.router, prefix="/api/orders", tags=["Order Management"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
