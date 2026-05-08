"""PG buy strategies — one psycopg2 connection per call."""
from __future__ import annotations

import time
from time import perf_counter

import psycopg2
import psycopg2.extensions

from database import DATABASE_URL

# tiny stall between SELECT and UPDATE in no-lock strategy → makes the race
# wide enough that overselling is reliable for the demo (without it, on a
# fast machine the OS scheduler can interleave too tightly to lose updates)
_RACE_WINDOW_S = 0.002

_SER = psycopg2.extensions.ISOLATION_LEVEL_SERIALIZABLE


def _ms_since(t0: float) -> float:
    return (perf_counter() - t0) * 1000.0


def buy_pg_no_lock(product_id: str) -> tuple[str, float]:
    """BAD: read-modify-write without locking. Will oversell under contention."""
    t0 = perf_counter()
    with psycopg2.connect(DATABASE_URL) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                "SELECT stock FROM m4_concurrency.product_stock WHERE product_id=%s",
                (product_id,),
            )
            stock = cur.fetchone()[0]
            if stock <= 0:
                return "rejected", _ms_since(t0)
            time.sleep(_RACE_WINDOW_S)
            cur.execute(
                "UPDATE m4_concurrency.product_stock SET stock=stock-1, updated_at=NOW() "
                "WHERE product_id=%s RETURNING stock",
                (product_id,),
            )
            new_stock = cur.fetchone()[0]
    return ("oversold" if new_stock < 0 else "sold"), _ms_since(t0)


def buy_pg_for_update(product_id: str) -> tuple[str, float]:
    """FIX: SELECT … FOR UPDATE serializes the read-modify-write."""
    t0 = perf_counter()
    with psycopg2.connect(DATABASE_URL) as conn:
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT stock FROM m4_concurrency.product_stock "
                    "WHERE product_id=%s FOR UPDATE",
                    (product_id,),
                )
                stock = cur.fetchone()[0]
                if stock <= 0:
                    conn.rollback()
                    return "rejected", _ms_since(t0)
                cur.execute(
                    "UPDATE m4_concurrency.product_stock SET stock=stock-1, updated_at=NOW() "
                    "WHERE product_id=%s",
                    (product_id,),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    return "sold", _ms_since(t0)


def buy_pg_serializable(product_id: str, max_retries: int = 10) -> tuple[str, float]:
    """FIX: ISOLATION SERIALIZABLE + retry loop on 40001."""
    t0 = perf_counter()
    last = None
    for _ in range(max_retries):
        conn = psycopg2.connect(DATABASE_URL)
        try:
            conn.set_session(isolation_level=_SER, autocommit=False)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT stock FROM m4_concurrency.product_stock WHERE product_id=%s",
                    (product_id,),
                )
                stock = cur.fetchone()[0]
                if stock <= 0:
                    conn.rollback()
                    last = "rejected"
                    break
                cur.execute(
                    "UPDATE m4_concurrency.product_stock SET stock=stock-1, updated_at=NOW() "
                    "WHERE product_id=%s",
                    (product_id,),
                )
            conn.commit()
            last = "sold"
            break
        except psycopg2.Error as e:
            if getattr(e, "pgcode", None) == "40001":
                try:
                    conn.rollback()
                except Exception:
                    pass
                continue
            raise
        finally:
            conn.close()
    return (last or "rejected"), _ms_since(t0)


def buy_pg_optimistic(product_id: str, max_retries: int = 50) -> tuple[str, float]:
    """FIX: optimistic concurrency via integer version column."""
    t0 = perf_counter()
    with psycopg2.connect(DATABASE_URL) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            for _ in range(max_retries):
                cur.execute(
                    "SELECT stock, version FROM m4_concurrency.product_stock WHERE product_id=%s",
                    (product_id,),
                )
                stock, version = cur.fetchone()
                if stock <= 0:
                    return "rejected", _ms_since(t0)
                cur.execute(
                    "UPDATE m4_concurrency.product_stock "
                    "SET stock=stock-1, version=version+1, updated_at=NOW() "
                    "WHERE product_id=%s AND version=%s",
                    (product_id, version),
                )
                if cur.rowcount == 1:
                    return "sold", _ms_since(t0)
                # else: somebody else bumped the version — retry
    return "rejected", _ms_since(t0)
