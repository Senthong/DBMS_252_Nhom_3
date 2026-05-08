"""
Member 1 – Topic II: Indexing
Demonstrates: B-tree index, Hash index, no-index comparison, Redis as secondary index
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import time
from database import get_db, redis_client

router = APIRouter()

@router.get("/benchmark")
def benchmark_query(order_id: str, db: Session = Depends(get_db)):
    """Compare query time with vs without index on orders.order_id"""
    # Without index (seq scan via disable)
    db.execute(text("SET enable_indexscan = OFF; SET enable_bitmapscan = OFF;"))
    t0 = time.perf_counter()
    db.execute(text("SELECT * FROM public.orders WHERE order_id = :oid"), {"oid": order_id})
    no_index_ms = round((time.perf_counter() - t0) * 1000, 3)

    # With index
    db.execute(text("SET enable_indexscan = ON; SET enable_bitmapscan = ON;"))
    t1 = time.perf_counter()
    db.execute(text("SELECT * FROM public.orders WHERE order_id = :oid"), {"oid": order_id})
    with_index_ms = round((time.perf_counter() - t1) * 1000, 3)

    return {"no_index_ms": no_index_ms, "with_index_ms": with_index_ms}

@router.get("/explain")
def explain_query(db: Session = Depends(get_db)):
    """Show EXPLAIN ANALYZE on orders join order_items"""
    result = db.execute(text(
        "EXPLAIN ANALYZE SELECT o.order_id, SUM(oi.price) "
        "FROM public.orders o JOIN public.order_items oi USING(order_id) "
        "GROUP BY o.order_id LIMIT 100"
    ))
    return {"plan": [row[0] for row in result]}

@router.post("/create-index")
def create_index(db: Session = Depends(get_db)):
    """Create B-tree index on orders.customer_id"""
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id)"))
    db.commit()
    return {"message": "Index created: idx_orders_customer"}

@router.get("/redis-lookup/{order_id}")
def redis_lookup(order_id: str, db: Session = Depends(get_db)):
    """Secondary index via Redis: order_id -> customer_id"""
    cached = redis_client.get(f"order:{order_id}:customer")
    if cached:
        return {"source": "redis", "customer_id": cached}
    row = db.execute(
        text("SELECT customer_id FROM public.orders WHERE order_id = :oid"),
        {"oid": order_id}
    ).fetchone()
    if row:
        redis_client.setex(f"order:{order_id}:customer", 3600, row[0])
        return {"source": "postgres", "customer_id": row[0]}
    return {"error": "not found"}
