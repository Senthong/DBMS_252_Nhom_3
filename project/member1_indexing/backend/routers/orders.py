import datetime
import time
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
import schemas

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

# 1. Search with Composite Condition (Requirement e)
@router.get("/", response_model=list[schemas.OrderResponse])
def search_orders(status: str = None, customer_id: str = None, limit: int = 50, db: Session = Depends(get_db)):
    query = "SELECT * FROM public.orders WHERE 1=1"
    params = {"limit": limit}
    
    if status:
        query += " AND order_status = :status"
        params["status"] = status
    if customer_id:
        # Use exact match or LIKE for partial search
        query += " AND customer_id = :customer_id"
        params["customer_id"] = customer_id
        
    query += " ORDER BY order_purchase_timestamp DESC LIMIT :limit"
    sql_text = text(query)

    # Initialize Indexes
    index_query = text("""
        -- 1. Primary index for customer search (with or without status)
        CREATE INDEX IF NOT EXISTS idx_orders_customer_status_time 
        ON public.orders USING btree 
        (customer_id, order_status, order_purchase_timestamp DESC);

        -- 2. Secondary index for status-only filtering or latest orders retrieval
        CREATE INDEX IF NOT EXISTS idx_orders_status_time 
        ON public.orders USING btree 
        (order_status, order_purchase_timestamp DESC);
    """)
    db.execute(index_query)

    # ==========================================
    # BENCHMARK 1: WITHOUT INDEX
    # ==========================================
    # Disable index scan methods in PostgreSQL planner
    db.execute(text("SET enable_indexscan = off;"))
    db.execute(text("SET enable_bitmapscan = off;"))
    db.execute(text("SET enable_indexonlyscan = off;"))
    
    start_time_no_idx = time.perf_counter()
    # Execute query to measure time (results not stored)
    db.execute(sql_text, params).mappings().all() 
    end_time_no_idx = time.perf_counter()
    
    # ==========================================
    # BENCHMARK 2: WITH B-TREE INDEX
    # ==========================================
    # Re-enable default scanning methods
    db.execute(text("SET enable_indexscan = on;"))
    db.execute(text("SET enable_bitmapscan = on;"))
    db.execute(text("SET enable_indexonlyscan = on;"))
    
    start_time_idx = time.perf_counter()
    # Execute and store results for the response
    result = db.execute(sql_text, params).mappings().all()
    end_time_idx = time.perf_counter()

    # ==========================================
    # CALCULATION AND LOGGING
    # ==========================================
    time_no_index = (end_time_no_idx - start_time_no_idx) * 1000
    time_with_index = (end_time_idx - start_time_idx) * 1000
    
    # Calculate performance gain factor
    speedup = time_no_index / time_with_index if time_with_index > 0 else 0

    logger.info(
        f"[BENCHMARK] Orders Search | "
        f"No Index: {time_no_index:.2f} ms | "
        f"With B-Tree Index: {time_with_index:.2f} ms | "
        f"Speedup: {speedup:.2f}x"
    )
    return result

# 2. Get Order Detail (JOIN with order_items - Requirement f)
@router.get("/{order_id}")
def get_order_detail(order_id: str, db: Session = Depends(get_db)):
    query = """
        SELECT o.*, oi.product_id, oi.price, oi.freight_value
        FROM public.orders o
        LEFT JOIN public.order_items oi ON o.order_id = oi.order_id
        WHERE o.order_id = :order_id
    """
    params = {"order_id": order_id}
    sql_text = text(query)

    # Create Indexes for WHERE clause (orders) and JOIN condition (order_items)
    index_query = text("""
        CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
    """)
    db.execute(index_query)

    # ==========================================
    # BENCHMARK 1: WITHOUT INDEX
    # ==========================================
    db.execute(text("SET enable_indexscan = off;"))
    db.execute(text("SET enable_bitmapscan = off;"))
    db.execute(text("SET enable_indexonlyscan = off;"))
    
    start_time_no_idx = time.perf_counter()
    db.execute(sql_text, params).mappings().all() 
    end_time_no_idx = time.perf_counter()

    # ==========================================
    # BENCHMARK 2: WITH INDEX
    # ==========================================
    db.execute(text("SET enable_indexscan = on;"))
    db.execute(text("SET enable_bitmapscan = on;"))
    db.execute(text("SET enable_indexonlyscan = on;"))
    
    start_time_idx = time.perf_counter()
    result = db.execute(sql_text, params).mappings().all()
    end_time_idx = time.perf_counter()

    # ==========================================
    # CALCULATION AND LOGGING
    # ==========================================
    time_no_index = (end_time_no_idx - start_time_no_idx) * 1000
    time_with_index = (end_time_idx - start_time_idx) * 1000
    
    speedup = time_no_index / time_with_index if time_with_index > 0 else 0

    logger.info(
        f"[BENCHMARK] Order Detail (order_id={order_id}) | "
        f"No Index: {time_no_index:.2f} ms | "
        f"With Index: {time_with_index:.2f} ms | "
        f"Speedup: {speedup:.2f}x"
    )

    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Data aggregation (1 Order -> Multiple Items)
    order_info = dict(result[0])
    items = [{"product_id": r["product_id"], "price": r["price"], "freight_value": r["freight_value"]} for r in result if r["product_id"]]
    
    return {"order_info": order_info, "items": items}

# 3. Create New Order (Requirement a)
@router.post("/", response_model=schemas.OrderResponse)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    # 1. Validate customer existence (excluded from benchmark)
    customer_exists = db.execute(
        text("SELECT 1 FROM public.customers WHERE customer_id = :cid"), 
        {"cid": order.customer_id}
    ).fetchone()
    
    if not customer_exists:
        raise HTTPException(status_code=400, detail="Customer ID does not exist")

    query = """
        INSERT INTO public.orders (order_id, customer_id, order_status, order_purchase_timestamp)
        VALUES (:order_id, :customer_id, :order_status, :timestamp)
    """
    timestamp = order.order_purchase_timestamp or datetime.datetime.now()
    
    # ==========================================
    # START INSERT BENCHMARK
    # ==========================================
    start_time = time.perf_counter()
    
    try:
        db.execute(text(query), {
            "order_id": order.order_id,
            "customer_id": order.customer_id,
            "order_status": order.order_status,
            "timestamp": timestamp
        })
        # Commit included in benchmark due to I/O overhead
        db.commit() 
        
        end_time = time.perf_counter()
        execution_time_ms = (end_time - start_time) * 1000
        
        logger.info(
            f"[BENCHMARK INSERT] Order ID: {order.order_id} | "
            f"Execution Time: {execution_time_ms:.3f} ms"
        )
        
        return {**order.dict(), "order_purchase_timestamp": timestamp}
    except Exception as e:
        db.rollback()
        end_time = time.perf_counter()
        execution_time_ms = (end_time - start_time) * 1000
        logger.info(
            f"[BENCHMARK INSERT - FAILED] Order ID: {order.order_id} | "
            f"Execution Time: {execution_time_ms:.3f} ms"
        )
        raise HTTPException(status_code=400, detail=str(e))

# 4. Update Order Status (Requirement c)
@router.put("/{order_id}")
def update_order(order_id: str, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    query = "UPDATE public.orders SET order_status = :status WHERE order_id = :order_id"
    result = db.execute(text(query), {"status": order_update.order_status, "order_id": order_id})
    db.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order updated successfully"}

# 5. Delete Order (Requirement b)
@router.delete("/{order_id}")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    
    # ==========================================
    # START DELETE BENCHMARK
    # ==========================================
    start_time = time.perf_counter()
    
    try:
        # Cascade deletion: remove related records first due to Foreign Key constraints
        db.execute(text("DELETE FROM public.order_items WHERE order_id = :order_id"), {"order_id": order_id})
        db.execute(text("DELETE FROM public.order_payments WHERE order_id = :order_id"), {"order_id": order_id})
        db.execute(text("DELETE FROM public.order_reviews WHERE order_id = :order_id"), {"order_id": order_id})
        
        # Finally delete primary order record
        result = db.execute(text("DELETE FROM public.orders WHERE order_id = :order_id"), {"order_id": order_id})
        db.commit()
        
        end_time = time.perf_counter()
        execution_time_ms = (end_time - start_time) * 1000
        
        logger.info(
            f"[BENCHMARK DELETE] Order ID: {order_id} | "
            f"Execution Time: {execution_time_ms:.3f} ms"
        )
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Order not found")
            
        return {"message": "Order and related records deleted successfully"}
        
    except Exception as e:
        db.rollback() 
        end_time = time.perf_counter()
        execution_time_ms = (end_time - start_time) * 1000
        logger.info(
            f"[BENCHMARK DELETE - FAILED] Order ID: {order_id} | "
            f"Execution Time: {execution_time_ms:.3f} ms"
        )
        if "Order not found" not in str(e):
            logger.error(f"Error deleting order: {e}")
            raise HTTPException(status_code=500, detail="Database error occurred during deletion")
        raise