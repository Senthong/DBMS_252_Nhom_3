"""Member 4 — Topic V: Concurrency Control.

Demo backend exposing:
  - phenomena lab (Postgres + Redis side-by-side)
  - flash-sale simulator (7 strategies)
  - live inspection (pg_locks, pg_stat_activity, redis CLIENT LIST)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import migrate
from routers import admin, inspect, phenomena_pg, phenomena_redis, scenario
from workers import registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate.run()
    yield
    registry.close_all()


app = FastAPI(title="Concurrency Control API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router, prefix="/api/concurrency/admin", tags=["admin"])
app.include_router(phenomena_pg.router, prefix="/api/concurrency/pheno/pg", tags=["phenomena-pg"])
app.include_router(phenomena_redis.router, prefix="/api/concurrency/pheno/redis", tags=["phenomena-redis"])
app.include_router(scenario.router, prefix="/api/concurrency/sale", tags=["sale"])
app.include_router(inspect.router, prefix="/api/concurrency/inspect", tags=["inspect"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8004, reload=True, workers=1)
