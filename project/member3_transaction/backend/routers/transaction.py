"""
Member 3 – Topic IV: Transaction
======================================================
Endpoints:
  POST /commit-demo          – insert + commit (ACID: Atomicity + Durability)
  POST /rollback-demo        – insert + force error → rollback (Atomicity)
  POST /savepoint-demo       – partial rollback via SAVEPOINT (Consistency)
  POST /transfer-demo        – balance transfer between 2 accounts (all ACID)
  POST /redis-transaction    – Redis MULTI/EXEC pipeline
  POST /redis-discard        – Redis MULTI + DISCARD (compare vs PG rollback)
  GET  /history              – all demo transactions recorded
  GET  /stats                – count & summary of demo runs
  DELETE /history/clear      – clear demo records
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db, redis_client
import uuid, time
from datetime import datetime

router = APIRouter()

# ── helpers ────────────────────────────────────────────────────────────────

def new_id(prefix="demo"):
    return f"{prefix}-{str(uuid.uuid4())[:8]}"

def log_redis(event: str, detail: str):
    """Append a log entry to Redis list (capped at 100)"""
    entry = f"{datetime.utcnow().isoformat()}|{event}|{detail}"
    redis_client.lpush("txn:log", entry)
    redis_client.ltrim("txn:log", 0, 99)

# ── schemas ────────────────────────────────────────────────────────────────

class TransferRequest(BaseModel):
    from_account: str
    to_account: str
    amount: float

# ── ensure demo tables exist ───────────────────────────────────────────────

def ensure_tables(db: Session):
    db.execute(text("CREATE SCHEMA IF NOT EXISTS m3_transaction"))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS m3_transaction.txn_demo_log (
            id          SERIAL PRIMARY KEY,
            demo_type   VARCHAR(30),
            order_id    VARCHAR(60),
            status      VARCHAR(20),
            note        TEXT,
            created_at  TIMESTAMP DEFAULT NOW()
        )   
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS m3_transaction.accounts (
            account_id  VARCHAR(30) PRIMARY KEY,
            owner       VARCHAR(50),
            balance     NUMERIC(12,2) DEFAULT 0
        )
    """))
    # seed two accounts if empty
    db.execute(text("""
        INSERT INTO m3_transaction.accounts(account_id, owner, balance)
        VALUES ('ACC-ALPHA', 'Alice', 10000),
               ('ACC-BETA',  'Bob',   5000)
        ON CONFLICT DO NOTHING
    """))
    db.commit()

# ── 1. COMMIT demo ─────────────────────────────────────────────────────────

@router.post("/commit-demo", summary="Insert order then COMMIT")
def commit_demo(db: Session = Depends(get_db)):
    """
    Demonstrates: Atomicity + Durability
    - Insert a fake order inside a transaction
    - Commit → data persists
    """
    ensure_tables(db)
    oid = new_id("commit")
    cid = "demo-customer-001"

    db.execute(text(
        "INSERT INTO public.orders(order_id, customer_id, order_status, order_purchase_timestamp) "
        "VALUES (:oid, :cid, 'txn_committed', NOW())"
    ), {"oid": oid, "cid": cid})

    db.execute(text(
        "INSERT INTO m3_transaction.txn_demo_log(demo_type, order_id, status, note) "
        "VALUES ('commit', :oid, 'committed', 'Inserted and committed successfully')"
    ), {"oid": oid})

    db.commit()
    log_redis("commit", oid)

    return {
        "demo": "commit",
        "order_id": oid,
        "result": "committed",
        "acid_property": "Atomicity + Durability",
        "explanation": "All operations in this transaction completed and were permanently saved."
    }

# ── 2. ROLLBACK demo ───────────────────────────────────────────────────────

@router.post("/rollback-demo", summary="Insert order then force ROLLBACK")
def rollback_demo(db: Session = Depends(get_db)):
    """
    Demonstrates: Atomicity
    - Insert a fake order
    - Trigger a division-by-zero error
    - SQLAlchemy catches → rollback → order never saved
    """
    ensure_tables(db)
    oid = new_id("rollback")

    try:
        db.execute(text(
            "INSERT INTO public.orders(order_id, customer_id, order_status, order_purchase_timestamp) "
            "VALUES (:oid, 'demo-customer-001', 'txn_rolled_back', NOW())"
        ), {"oid": oid})

        # intentional error to trigger rollback
        db.execute(text("SELECT 1/0"))
        db.commit()

    except Exception as e:
        db.rollback()

        db2 = next(get_db())
        ensure_tables(db2)
        db2.execute(text(
            "INSERT INTO m3_transaction.txn_demo_log(demo_type, order_id, status, note) "
            "VALUES ('rollback', :oid, 'rolled_back', :note)"
        ), {"oid": oid, "note": str(e)[:200]})
        db2.commit()
        db2.close()

        log_redis("rollback", oid)

        return {
            "demo": "rollback",
            "order_id": oid,
            "result": "rolled_back",
            "acid_property": "Atomicity",
            "error": str(e),
            "explanation": "Error occurred mid-transaction. All changes were reverted — order was NOT saved."
        }

# ── 3. SAVEPOINT demo ─────────────────────────────────────────────────────

@router.post("/savepoint-demo", summary="SAVEPOINT – partial rollback")
def savepoint_demo(db: Session = Depends(get_db)):
    """
    Demonstrates: Consistency
    - Insert order A → SAVEPOINT
    - Insert order B → error → ROLLBACK TO SAVEPOINT
    - Order A committed, order B discarded
    """
    ensure_tables(db)
    oid_a = new_id("sp-ok")
    oid_b = new_id("sp-fail")

    conn = db.connection()
    conn.execute(text("BEGIN"))

    conn.execute(text(
        "INSERT INTO public.orders(order_id, customer_id, order_status, order_purchase_timestamp) "
        "VALUES (:oid, 'demo-customer-001', 'savepoint_ok', NOW())"
    ), {"oid": oid_a})

    conn.execute(text("SAVEPOINT sp1"))

    try:
        conn.execute(text(
            "INSERT INTO public.orders(order_id, customer_id, order_status, order_purchase_timestamp) "
            "VALUES (:oid, 'demo-customer-001', 'savepoint_fail', NOW())"
        ), {"oid": oid_b})
        conn.execute(text("SELECT 1/0"))  # force error
    except Exception as e:
        conn.execute(text("ROLLBACK TO SAVEPOINT sp1"))

    conn.execute(text(
        "INSERT INTO m3_transaction.txn_demo_log(demo_type, order_id, status, note) "
        "VALUES ('savepoint', :oid, 'partial_commit', 'A committed, B rolled back')"
    ), {"oid": oid_a})

    conn.execute(text("COMMIT"))
    log_redis("savepoint", f"{oid_a}|{oid_b}")

    return {
        "demo": "savepoint",
        "committed": oid_a,
        "rolled_back_to_savepoint": oid_b,
        "acid_property": "Consistency",
        "explanation": "SAVEPOINT allowed partial rollback. Order A persisted; Order B was discarded after error."
    }

# ── 4. TRANSFER demo (full ACID) ──────────────────────────────────────────

@router.post("/transfer-demo", summary="Balance transfer – full ACID demo")
def transfer_demo(body: TransferRequest, db: Session = Depends(get_db)):
    """
    Demonstrates: All 4 ACID properties
    - Debit from_account, credit to_account atomically
    - Check balance constraint (Consistency)
    - Isolation: row-level lock via SELECT FOR UPDATE
    - Durability: committed to disk
    """
    ensure_tables(db)

    try:
        from_row = db.execute(
            text("SELECT balance FROM m3_transaction.accounts WHERE account_id = :aid FOR UPDATE"),
            {"aid": body.from_account}
        ).fetchone()

        to_row = db.execute(
            text("SELECT balance FROM m3_transaction.accounts WHERE account_id = :aid FOR UPDATE"),
            {"aid": body.to_account}
        ).fetchone()

        if not from_row or not to_row:
            raise HTTPException(status_code=404, detail="Account not found")

        if from_row[0] < body.amount:
            raise HTTPException(status_code=400, detail=f"Insufficient balance: {from_row[0]}")

        db.execute(
            text("UPDATE m3_transaction.accounts SET balance = balance - :amt WHERE account_id = :aid"),
            {"amt": body.amount, "aid": body.from_account}
        )
        db.execute(
            text("UPDATE m3_transaction.accounts SET balance = balance + :amt WHERE account_id = :aid"),
            {"amt": body.amount, "aid": body.to_account}
        )

        db.execute(text(
            "INSERT INTO m3_transaction.txn_demo_log(demo_type, order_id, status, note) "
            "VALUES ('transfer', :ref, 'committed', :note)"
        ), {"ref": f"{body.from_account}->{body.to_account}",
            "note": f"Transferred {body.amount} successfully"})

        db.commit()
        log_redis("transfer", f"{body.from_account}->{body.to_account}:{body.amount}")

        new_from = db.execute(
            text("SELECT balance FROM m3_transaction.accounts WHERE account_id = :aid"),
            {"aid": body.from_account}
        ).scalar()
        new_to = db.execute(
            text("SELECT balance FROM m3_transaction.accounts WHERE account_id = :aid"),
            {"aid": body.to_account}
        ).scalar()

        return {
            "demo": "transfer",
            "from": body.from_account,
            "to": body.to_account,
            "amount": body.amount,
            "new_balance_from": float(new_from),
            "new_balance_to": float(new_to),
            "acid_property": "All 4 (Atomicity, Consistency, Isolation, Durability)",
            "explanation": "SELECT FOR UPDATE ensured isolation. Both debit+credit are atomic. Constraint (balance≥0) enforces consistency."
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ── 5. Redis MULTI/EXEC ───────────────────────────────────────────────────

@router.post("/redis-transaction", summary="Redis MULTI/EXEC pipeline")
def redis_transaction():
    """
    Demonstrates: Redis transaction via MULTI/EXEC
    - Atomic batch of commands
    - Compare with PostgreSQL COMMIT behavior
    """
    pipe = redis_client.pipeline(transaction=True)
    pipe.set("txn:demo:counter", 0)
    pipe.incr("txn:demo:counter")
    pipe.incr("txn:demo:counter")
    pipe.incr("txn:demo:counter")
    results = pipe.execute()
    final = redis_client.get("txn:demo:counter")
    log_redis("redis_multi_exec", f"final={final}")

    return {
        "demo": "redis_multi_exec",
        "pipeline_results": results,
        "final_counter": final,
        "explanation": "MULTI queues commands; EXEC runs them atomically. No other client can interleave.",
        "vs_postgres": "Similar to BEGIN/COMMIT, but Redis has no rollback on error — use WATCH for optimistic locking."
    }

# ── 6. Redis DISCARD ──────────────────────────────────────────────────────

@router.post("/redis-discard", summary="Redis MULTI + DISCARD (compare to ROLLBACK)")
def redis_discard():
    """
    Demonstrates: DISCARD cancels a queued MULTI block — analogous to ROLLBACK
    """
    pipe = redis_client.pipeline(transaction=True)
    before = redis_client.get("txn:demo:counter") or "0"
    pipe.set("txn:demo:counter", 9999)  # would overwrite
    pipe.reset()                         # DISCARD equivalent
    after = redis_client.get("txn:demo:counter") or "0"
    log_redis("redis_discard", f"before={before} after={after}")

    return {
        "demo": "redis_discard",
        "counter_before": before,
        "counter_after": after,
        "explanation": "pipe.reset() sends DISCARD — queued commands are cancelled, counter unchanged.",
        "vs_postgres": "Equivalent to ROLLBACK in PostgreSQL."
    }

# ── 7. History ────────────────────────────────────────────────────────────

@router.get("/history", summary="All demo transaction logs")
def history(db: Session = Depends(get_db)):
    ensure_tables(db)
    rows = db.execute(text(
        "SELECT id, demo_type, order_id, status, note, created_at "
        "FROM m3_transaction.txn_demo_log ORDER BY created_at DESC LIMIT 50"
    )).fetchall()

    redis_log = redis_client.lrange("txn:log", 0, 19)
    parsed_redis = []
    for entry in redis_log:
        parts = entry.split("|", 2)
        if len(parts) == 3:
            parsed_redis.append({"ts": parts[0], "event": parts[1], "detail": parts[2]})

    return {
        "postgres_log": [dict(r._mapping) for r in rows],
        "redis_log": parsed_redis,
    }

# ── 8. Stats ──────────────────────────────────────────────────────────────

@router.get("/stats", summary="Summary counts of each demo type")
def stats(db: Session = Depends(get_db)):
    ensure_tables(db)
    rows = db.execute(text(
        "SELECT demo_type, status, COUNT(*) AS count "
        "FROM m3_transaction.txn_demo_log "
        "GROUP BY demo_type, status ORDER BY demo_type"
    )).fetchall()

    accounts = db.execute(text(
        "SELECT account_id, owner, balance FROM m3_transaction.accounts"
    )).fetchall()

    return {
        "demo_counts": [dict(r._mapping) for r in rows],
        "accounts": [dict(r._mapping) for r in accounts],
    }

# ── 9. Clear ──────────────────────────────────────────────────────────────

@router.delete("/history/clear", summary="Clear all demo logs and reset accounts")
def clear_history(db: Session = Depends(get_db)):
    ensure_tables(db)
    db.execute(text("DELETE FROM m3_transaction.txn_demo_log"))
    db.execute(text(
        "UPDATE m3_transaction.accounts SET balance = CASE "
        "WHEN account_id = 'ACC-ALPHA' THEN 10000 "
        "WHEN account_id = 'ACC-BETA'  THEN 5000 END"
    ))
    db.execute(text(
        "DELETE FROM public.orders WHERE order_status IN "
        "('txn_committed','txn_rolled_back','savepoint_ok','savepoint_fail')"
    ))
    db.commit()
    redis_client.delete("txn:log", "txn:demo:counter")
    return {"status": "cleared", "accounts_reset": True}
