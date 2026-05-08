"""
Member 2 – Topic III: Query Processing
Covers all required query types: insert, delete, update, single/composite condition,
join, subquery, aggregate + EXPLAIN ANALYZE comparison
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db

router = APIRouter()

# a. Insert
@router.post("/insert-order")
def insert_order(order_id: str, customer_id: str, status: str = "created", db: Session = Depends(get_db)):
    db.execute(text(
        "INSERT INTO public.orders(order_id, customer_id, order_status, order_purchase_timestamp) "
        "VALUES (:oid, :cid, :status, NOW()) ON CONFLICT DO NOTHING"
    ), {"oid": order_id, "cid": customer_id, "status": status})
    db.commit()
    return {"inserted": order_id}

# b. Delete
@router.delete("/delete-order/{order_id}")
def delete_order(order_id: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM public.orders WHERE order_id = :oid"), {"oid": order_id})
    db.commit()
    return {"deleted": order_id}

# c. Update
@router.put("/update-status/{order_id}")
def update_status(order_id: str, status: str, db: Session = Depends(get_db)):
    db.execute(text("UPDATE public.orders SET order_status = :s WHERE order_id = :oid"),
               {"s": status, "oid": order_id})
    db.commit()
    return {"updated": order_id}

# d. Single condition
@router.get("/orders-by-status")
def orders_by_status(status: str, db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT order_id, order_status FROM public.orders WHERE order_status = :s LIMIT 20"),
                      {"s": status}).fetchall()
    return [dict(r._mapping) for r in rows]

# e. Composite condition
@router.get("/orders-composite")
def orders_composite(status: str, state: str, db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT o.order_id, c.customer_state FROM public.orders o "
        "JOIN public.customers c USING(customer_id) "
        "WHERE o.order_status = :s AND c.customer_state = :st LIMIT 20"
    ), {"s": status, "st": state}).fetchall()
    return [dict(r._mapping) for r in rows]

# f. Join
@router.get("/orders-with-items")
def orders_with_items(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT o.order_id, oi.product_id, oi.price "
        "FROM public.orders o JOIN public.order_items oi USING(order_id) LIMIT 20"
    )).fetchall()
    return [dict(r._mapping) for r in rows]

# g. Subquery
@router.get("/high-value-orders")
def high_value_orders(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT order_id FROM public.orders WHERE order_id IN ("
        "  SELECT order_id FROM public.order_payments "
        "  WHERE payment_value > (SELECT AVG(payment_value) FROM public.order_payments)"
        ") LIMIT 20"
    )).fetchall()
    return [r[0] for r in rows]

# h. Aggregate
@router.get("/revenue-by-state")
def revenue_by_state(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT c.customer_state, COUNT(o.order_id) AS total_orders, "
        "SUM(op.payment_value) AS total_revenue "
        "FROM public.orders o "
        "JOIN public.customers c USING(customer_id) "
        "JOIN public.order_payments op USING(order_id) "
        "GROUP BY c.customer_state ORDER BY total_revenue DESC LIMIT 10"
    )).fetchall()
    return [dict(r._mapping) for r in rows]

# EXPLAIN
@router.get("/explain")
def explain(query_type: str = "join", db: Session = Depends(get_db)):
    queries = {
        "join": "EXPLAIN ANALYZE SELECT o.order_id, oi.price FROM public.orders o JOIN public.order_items oi USING(order_id) LIMIT 100",
        "aggregate": "EXPLAIN ANALYZE SELECT customer_state, COUNT(*) FROM public.customers GROUP BY customer_state",
        "subquery": "EXPLAIN ANALYZE SELECT order_id FROM public.orders WHERE order_id IN (SELECT order_id FROM public.order_payments WHERE payment_value > 100)",
    }
    sql = queries.get(query_type, queries["join"])
    result = db.execute(text(sql))
    return {"plan": [row[0] for row in result]}


# RANK

@router.get("/products/ranking")
def product_ranking(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT 
            oi.product_id,
            COUNT(*) AS total_orders,
            RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
        FROM public.order_items oi
        GROUP BY oi.product_id
        ORDER BY rank
        LIMIT 10
    """)).fetchall()

    return [dict(r._mapping) for r in rows]

# Average price

@router.get("/products/{product_id}/average-price")
def get_average_price(product_id: str, db: Session = Depends(get_db)):
    row = db.execute(text("""
        SELECT 
            product_id,
            AVG(price) AS avg_price
        FROM public.order_items
        WHERE product_id = :pid
        GROUP BY product_id
    """), {"pid": product_id}).fetchone()

    if not row:
        return {
            "product_id": product_id,
            "avg_price": None,
            "message": "No sales data"
        }

    return {
        "product_id": row.product_id,
        "avg_price": float(row.avg_price)
    }

# GET PRO   
@router.get("/products")
def get_products(page: int = 1, limit: int = 8, db: Session = Depends(get_db)):
    offset = (page - 1) * limit

    rows = db.execute(text("""
        SELECT 
            p.product_id,
            p.product_category_name AS category,
            CONCAT(p.product_category_name, ' ', p.product_id) AS name,
            COALESCE(AVG(oi.price), 0) AS price,
            COUNT(oi.order_id) AS sold_count,
            CONCAT('https://picsum.photos/seed/', p.product_id, '/300/300') AS image

        FROM public.products p
        LEFT JOIN public.order_items oi
            ON p.product_id = oi.product_id

        GROUP BY p.product_id, p.product_category_name

        ORDER BY sold_count DESC
        LIMIT :limit OFFSET :offset
    """), {"limit": limit, "offset": offset}).fetchall()

    return [dict(r._mapping) for r in rows]

#SEARCH PRO
@router.get("/products/search")
def search_products(keyword: str, db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT 
            product_id,
            product_category_name AS category,
            CONCAT(product_category_name, ' ', product_id) AS name,
            CONCAT('https://picsum.photos/seed/', product_id, '/300/300') AS image
        FROM public.products
        WHERE product_category_name ILIKE :kw
           OR product_id ILIKE :kw
        LIMIT 20
    """), {"kw": f"%{keyword}%"}).fetchall()

    return [dict(r._mapping) for r in rows]