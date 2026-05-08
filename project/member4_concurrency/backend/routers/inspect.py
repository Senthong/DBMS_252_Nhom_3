"""Live inspection of locks, activity, and Redis clients. Auto-refreshed by the UI."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db, redis_client

router = APIRouter()


@router.get("/pg/locks")
def pg_locks(db: Session = Depends(get_db)):
    """pg_locks joined with pg_stat_activity — what's locking what, and why."""
    rows = db.execute(text("""
        SELECT l.pid,
               l.locktype,
               l.relation::regclass::text AS relation,
               l.mode,
               l.granted,
               l.transactionid::text AS xid,
               a.state,
               a.wait_event_type,
               a.wait_event,
               a.query
          FROM pg_locks l
          LEFT JOIN pg_stat_activity a USING (pid)
         WHERE l.relation IS NOT NULL
           AND a.datname = current_database()
         ORDER BY l.granted DESC, l.pid
         LIMIT 50
    """)).mappings().all()
    return [dict(r) for r in rows]


@router.get("/pg/activity")
def pg_activity(db: Session = Depends(get_db)):
    """Non-idle backends only — useful while a demo is running."""
    rows = db.execute(text("""
        SELECT pid, state, wait_event_type, wait_event, query, xact_start, query_start
          FROM pg_stat_activity
         WHERE datname = current_database() AND state IS NOT NULL AND state <> 'idle'
         ORDER BY query_start DESC NULLS LAST
         LIMIT 50
    """)).mappings().all()
    return [dict(r) for r in rows]


def _parse_client_line(line: str) -> dict:
    out: dict[str, str] = {}
    for tok in line.strip().split():
        if "=" in tok:
            k, _, v = tok.partition("=")
            out[k] = v
    return out


@router.get("/redis/clients")
def redis_clients():
    """CLIENT LIST parsed to JSON, plus a memory-stat summary."""
    raw = redis_client.execute_command("CLIENT", "LIST")
    if isinstance(raw, bytes):
        raw = raw.decode()
    clients = [_parse_client_line(ln) for ln in raw.splitlines() if ln.strip()]
    return clients


@router.get("/redis/info")
def redis_info():
    info = redis_client.info(section="memory")
    return {
        "used_memory_human": info.get("used_memory_human"),
        "used_memory_peak_human": info.get("used_memory_peak_human"),
        "maxmemory_human": info.get("maxmemory_human") or "(unset)",
    }
