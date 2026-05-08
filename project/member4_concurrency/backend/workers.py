"""Run registry for the phenomena lab + sale runner.

Phenomena lab needs *persistent transactions across HTTP requests* — that
rules out the per-request SQLAlchemy session. We hold raw psycopg2
connections in a process-local dict keyed by run_id. uvicorn must run with
--workers 1 (set in Dockerfile CMD) so step N+1 lands on the same process
that holds step N's open transaction.
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

import psycopg2
import psycopg2.extensions

from database import DATABASE_URL
from phenomena import Step, build_steps

ISOLATION_MAP = {
    "read_committed": psycopg2.extensions.ISOLATION_LEVEL_READ_COMMITTED,
    "repeatable_read": psycopg2.extensions.ISOLATION_LEVEL_REPEATABLE_READ,
    "serializable": psycopg2.extensions.ISOLATION_LEVEL_SERIALIZABLE,
}


def _safe_txid(conn) -> int | None:
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_current_xact_id()::text")
            return cur.fetchone()[0]
    except Exception:
        return None


@dataclass
class _Run:
    phenomenon: str
    isolation: str
    lock_mode: str
    steps: list[Step]
    conns: dict[int, Any] = field(default_factory=dict)  # session_id -> conn
    memory: dict[str, Any] = field(default_factory=dict)
    history: dict[int, list[dict]] = field(default_factory=lambda: {1: [], 2: []})
    closed: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)
    order_counter: int = 0


class RunRegistry:
    """Process-local, thread-safe enough for one uvicorn worker."""

    def __init__(self) -> None:
        self._runs: dict[str, _Run] = {}
        self._lock = threading.Lock()

    # -- lifecycle ---------------------------------------------------------

    def start(
        self,
        phenomenon: str,
        isolation: str = "read_committed",
        lock_mode: str = "none",
    ) -> str:
        if isolation not in ISOLATION_MAP:
            raise ValueError(f"bad isolation: {isolation!r}")
        steps = build_steps(phenomenon, lock_mode)
        run_id = uuid.uuid4().hex[:12]
        conns: dict[int, Any] = {}
        try:
            for sid in (1, 2):
                c = psycopg2.connect(DATABASE_URL)
                c.set_session(
                    isolation_level=ISOLATION_MAP[isolation],
                    readonly=False,
                    deferrable=False,
                    autocommit=False,
                )
                # short deadlock_timeout keeps the demo lively
                with c.cursor() as cur:
                    cur.execute("SET deadlock_timeout = '300ms'")
                c.commit()  # close the implicit tx opened by SET
                conns[sid] = c
        except Exception:
            for c in conns.values():
                try:
                    c.close()
                except Exception:
                    pass
            raise
        run = _Run(
            phenomenon=phenomenon,
            isolation=isolation,
            lock_mode=lock_mode,
            steps=steps,
            conns=conns,
        )
        with self._lock:
            self._runs[run_id] = run
        return run_id

    def step_count(self, run_id: str) -> int:
        return len(self._get(run_id).steps)

    def run_step(self, run_id: str, step_idx: int) -> dict:
        run = self._get(run_id)
        if run.closed:
            raise RuntimeError("run already closed")
        try:
            step = run.steps[step_idx]
        except IndexError as e:
            raise ValueError(f"bad step idx {step_idx}") from e
        # Each connection serializes its own actions but two different sessions
        # can run concurrently — that's the whole point.
        result = self._execute(run, step, step_idx)
        run.history[step.session].append(result)
        return result

    def state(self, run_id: str) -> dict:
        run = self._get(run_id)
        return {
            "phenomenon": run.phenomenon,
            "isolation": run.isolation,
            "lock_mode": run.lock_mode,
            "steps": [
                {"idx": i, "session": s.session, "kind": s.kind, "label": s.label, "sql": s.sql}
                for i, s in enumerate(run.steps)
            ],
            "sessions": {
                1: {"history": run.history[1]},
                2: {"history": run.history[2]},
            },
        }

    def abort(self, run_id: str) -> None:
        with self._lock:
            run = self._runs.pop(run_id, None)
        if run is None:
            return
        run.closed = True
        for c in run.conns.values():
            try:
                c.rollback()
            except Exception:
                pass
            try:
                c.close()
            except Exception:
                pass

    def close_all(self) -> None:
        for rid in list(self._runs.keys()):
            self.abort(rid)

    # -- internals ---------------------------------------------------------

    def _get(self, run_id: str) -> _Run:
        with self._lock:
            run = self._runs.get(run_id)
        if run is None:
            raise KeyError(f"run {run_id!r} not found")
        return run

    def _execute(self, run: _Run, step: Step, step_idx: int) -> dict:
        conn = run.conns[step.session]
        result: dict[str, Any] = {
            "step": step_idx,
            "session": step.session,
            "kind": step.kind,
            "label": step.label,
            "sql": step.sql,
            "rows": None,
            "error": None,
            "txid": None,
            "order": None,
        }
        try:
            if step.kind == "commit":
                conn.commit()
            elif step.kind == "rollback":
                conn.rollback()
            elif step.kind == "sql":
                params = {**run.memory, **step.params}
                with conn.cursor() as cur:
                    cur.execute(step.sql, params)
                    if cur.description is not None:
                        rows = cur.fetchall()
                        result["rows"] = rows
                        if step.remember and rows:
                            run.memory[step.remember] = rows[0][0]
                    result["txid"] = _safe_txid(conn)
            else:
                raise ValueError(f"unknown step kind: {step.kind}")
        except psycopg2.Error as e:
            result["error"] = f"{e.pgcode or ''} {str(e).strip()}".strip()
            try:
                conn.rollback()
            except Exception:
                pass
        with run.lock:
            run.order_counter += 1
            result["order"] = run.order_counter
        return result


# Process-local singleton — phase 2 backends import this.
registry = RunRegistry()


# --------------------------------------------------------------------------
# Phase 4 — flash-sale runner
# --------------------------------------------------------------------------
import asyncio
from time import perf_counter

from strategies import PG_STRATEGIES, REDIS_STRATEGIES, ALL_STRATEGIES
from strategies.redis_strategies import seed_redis_stock


def _percentile(xs: list[float], p: float) -> float:
    if not xs:
        return 0.0
    s = sorted(xs)
    k = max(0, min(len(s) - 1, int(round((p / 100.0) * (len(s) - 1)))))
    return s[k]


def reset_stock(product_id: str, stock: int) -> None:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE m4_concurrency.product_stock "
                "SET stock=%s, version=0, updated_at=NOW() WHERE product_id=%s",
                (stock, product_id),
            )
            if cur.rowcount == 0:
                # demo seed missing — caller probably forgot to seed
                raise RuntimeError(f"product_id {product_id!r} not in product_stock; call /admin/seed first")
        conn.commit()


def get_seeded_product_id() -> str:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT product_id FROM m4_concurrency.product_stock LIMIT 1")
            row = cur.fetchone()
    if row is None:
        raise RuntimeError("no product_stock seed; call /admin/seed first")
    return row[0]


def get_stock_after(product_id: str) -> int:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT stock FROM m4_concurrency.product_stock WHERE product_id=%s",
                        (product_id,))
            return cur.fetchone()[0]


async def run_sale(strategy: str, buyers: int, stock_init: int,
                    product_id: str | None = None) -> dict:
    if strategy not in ALL_STRATEGIES:
        raise ValueError(f"unknown strategy {strategy!r}; choices: {ALL_STRATEGIES}")
    pid = product_id or get_seeded_product_id()
    reset_stock(pid, stock_init)
    if strategy in ("redis_decr", "redis_watch"):
        await seed_redis_stock(stock_init)

    t0 = perf_counter()
    if strategy in PG_STRATEGIES:
        fn = PG_STRATEGIES[strategy]
        tasks = [asyncio.to_thread(fn, pid) for _ in range(buyers)]
    else:
        fn = REDIS_STRATEGIES[strategy]
        tasks = [fn(pid) for _ in range(buyers)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    elapsed_ms = int((perf_counter() - t0) * 1000)

    timeline: list[dict] = []
    latencies: list[float] = []
    sold = oversold = rejected = errors = 0
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            errors += 1
            timeline.append({"buyer": i, "outcome": "error", "ms": 0, "error": str(r)})
            continue
        outcome, ms = r
        latencies.append(ms)
        timeline.append({"buyer": i, "outcome": outcome, "ms": round(ms, 2)})
        if outcome == "sold":
            sold += 1
        elif outcome == "oversold":
            oversold += 1
        else:
            rejected += 1

    p50 = _percentile(latencies, 50)
    p99 = _percentile(latencies, 99)
    stock_after = get_stock_after(pid)

    notes = []
    if errors:
        notes.append(f"{errors} task error(s)")
    if strategy in ("redis_decr", "redis_watch"):
        notes.append("stock counter in Redis")

    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO m4_concurrency.run_log "
                "(strategy, buyers, initial_stock, sold, oversold, elapsed_ms, p99_ms, notes) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
                (strategy, buyers, stock_init, sold, oversold, elapsed_ms, int(p99), "; ".join(notes)),
            )
            run_log_id = cur.fetchone()[0]
        conn.commit()

    return {
        "id": run_log_id,
        "strategy": strategy,
        "buyers": buyers,
        "stock_init": stock_init,
        "sold": sold,
        "oversold": oversold,
        "rejected": rejected,
        "errors": errors,
        "elapsed_ms": elapsed_ms,
        "p50_ms": round(p50, 2),
        "p99_ms": round(p99, 2),
        "stock_after": stock_after,
        "timeline": timeline,
        "product_id": pid,
    }
