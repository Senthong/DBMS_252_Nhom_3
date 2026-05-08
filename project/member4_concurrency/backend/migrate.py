"""Apply 001_init.sql + idempotent seed for the demo. Called on FastAPI startup."""
import os
from pathlib import Path
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/ecommerce")
MIGRATION_FILE = Path(__file__).parent / "migrations" / "001_init.sql"

DEFAULT_STOCK = 10


def _apply_schema(cur) -> None:
    cur.execute(MIGRATION_FILE.read_text())


def _seed_product_stock(cur) -> None:
    cur.execute("SELECT COUNT(*) FROM m4_concurrency.product_stock")
    if cur.fetchone()[0] > 0:
        return
    # pick the highest-volume product so the demo references a "real" item
    cur.execute(
        "SELECT product_id FROM public.order_items "
        "GROUP BY product_id ORDER BY COUNT(*) DESC, product_id ASC LIMIT 1"
    )
    row = cur.fetchone()
    if row is None:
        # fallback: any product (edge case: empty order_items)
        cur.execute("SELECT product_id FROM public.products ORDER BY product_id LIMIT 1")
        row = cur.fetchone()
    if row is None:
        return  # public.products empty — nothing to seed yet
    cur.execute(
        "INSERT INTO m4_concurrency.product_stock(product_id, stock, version) "
        "VALUES (%s, %s, 0) ON CONFLICT (product_id) DO NOTHING",
        (row[0], DEFAULT_STOCK),
    )


def _seed_accounts(cur) -> None:
    cur.executemany(
        "INSERT INTO m4_concurrency.accounts(account_id, color, balance) "
        "VALUES (%s, %s, %s) ON CONFLICT (account_id) DO NOTHING",
        [("alice", "B", 1), ("bob", "W", 1)],
    )


def _seed_demo_counter(cur) -> None:
    cur.execute(
        "INSERT INTO m4_concurrency.demo_counter(name, value) VALUES ('lu', 0) "
        "ON CONFLICT (name) DO NOTHING"
    )


def run() -> None:
    """Idempotent: safe to call on every backend startup."""
    with psycopg2.connect(DATABASE_URL) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            _apply_schema(cur)
            _seed_product_stock(cur)
            _seed_accounts(cur)
            _seed_demo_counter(cur)
        conn.commit()


def reset_run_log_and_stock() -> None:
    """Used by /admin/reset — clears run_log + restores demo state to seed values."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE m4_concurrency.run_log RESTART IDENTITY")
            cur.execute(
                "UPDATE m4_concurrency.product_stock SET stock=%s, version=0, updated_at=NOW()",
                (DEFAULT_STOCK,),
            )
            cur.execute("DELETE FROM m4_concurrency.accounts WHERE account_id NOT IN ('alice','bob')")
            cur.execute("UPDATE m4_concurrency.accounts SET balance=1 WHERE account_id IN ('alice','bob')")
            cur.execute("UPDATE m4_concurrency.demo_counter SET value=0")
        conn.commit()


if __name__ == "__main__":
    run()
    print("[migrate] applied 001_init.sql + seed")
