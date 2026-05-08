import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import redis

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/ecommerce")
REDIS_URL    = os.getenv("REDIS_URL", "redis://localhost:6379")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
