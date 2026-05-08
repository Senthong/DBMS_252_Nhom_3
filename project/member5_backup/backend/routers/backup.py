"""
Member 5 – Topic VI: Backup & Recovery
Demonstrates: pg_dump, pg_restore, Redis BGSAVE (RDB), Redis BGREWRITEAOF (AOF)
"""
from fastapi import APIRouter
from database import redis_client
import subprocess, os, glob
from datetime import datetime

router = APIRouter()
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

PG_CONN = {
    "host": os.getenv("PG_HOST", "postgres"),
    "port": os.getenv("PG_PORT", "5432"),
    "user": os.getenv("PG_USER", "admin"),
    "db":   os.getenv("PG_DB",   "ecommerce"),
    "pass": os.getenv("PGPASSWORD", "admin"),
}

@router.post("/pg-dump")
def pg_dump():
    """Run pg_dump and save to backups/"""
    filename = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)
    env = {**os.environ, "PGPASSWORD": PG_CONN["pass"]}
    result = subprocess.run([
        "pg_dump",
        "-h", PG_CONN["host"],
        "-p", PG_CONN["port"],
        "-U", PG_CONN["user"],
        "-d", PG_CONN["db"],
        "-f", filepath,
        "--no-password"
    ], capture_output=True, text=True, env=env)
    if result.returncode == 0:
        return {"status": "success", "file": filename}
    return {"status": "error", "stderr": result.stderr}

@router.get("/list-backups")
def list_backups():
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "*.sql")), reverse=True)
    return [{"name": os.path.basename(f), "size_kb": round(os.path.getsize(f)/1024, 1)} for f in files]

@router.post("/pg-restore/{filename}")
def pg_restore(filename: str):
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        return {"error": "file not found"}
    env = {**os.environ, "PGPASSWORD": PG_CONN["pass"]}
    result = subprocess.run([
        "psql",
        "-h", PG_CONN["host"],
        "-p", PG_CONN["port"],
        "-U", PG_CONN["user"],
        "-d", PG_CONN["db"],
        "-f", filepath
    ], capture_output=True, text=True, env=env)
    return {"status": "done" if result.returncode == 0 else "error", "output": result.stdout[-500:]}

@router.post("/redis-bgsave")
def redis_bgsave():
    """Trigger Redis RDB background save"""
    redis_client.bgsave()
    info = redis_client.info("persistence")
    return {
        "status": "triggered",
        "rdb_last_save": info.get("rdb_last_bgsave_time_sec"),
        "aof_enabled": info.get("aof_enabled"),
    }

@router.post("/redis-aof-rewrite")
def redis_aof():
    """Trigger Redis AOF rewrite"""
    redis_client.bgrewriteaof()
    return {"status": "AOF rewrite triggered"}

@router.get("/redis-info")
def redis_info():
    info = redis_client.info("persistence")
    return {k: v for k, v in info.items() if any(x in k for x in ["rdb", "aof", "save"])}
