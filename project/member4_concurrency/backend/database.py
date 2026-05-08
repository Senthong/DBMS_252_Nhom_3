"""DB / cache clients for Member 4. Three handles, all reading the same env vars.

  - SQLAlchemy session for simple read endpoints (inspect, scenario list).
  - Raw psycopg2 connections for the phenomena lab (need autocommit=False
    held *across HTTP requests* — SQLAlchemy session lifecycle would fight us).
  - Sync redis (existing toy code) + async redis (real overlap in sale runner).
"""
import os

import psycopg2
import redis as sync_redis
import redis.asyncio as async_redis_pkg
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/ecommerce")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
redis_client = sync_redis.from_url(REDIS_URL, decode_responses=True)
async_redis = async_redis_pkg.from_url(REDIS_URL, decode_responses=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_pg_conn(autocommit: bool = False):
    """Open a fresh raw psycopg2 connection. Caller is responsible for close()."""
    c = psycopg2.connect(DATABASE_URL)
    c.autocommit = autocommit
    return c
