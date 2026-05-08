"""Phase 4 — concurrency-claim assertions on each strategy under a flash sale.

Bad strategy MUST oversell or the demo is fake. Fixed strategies MUST never
oversell. These tests are the actual proof of the concurrency claim.
"""
import pytest

import migrate
import workers


@pytest.fixture(autouse=True)
def _reset(reset_m4):
    migrate.run()
    yield
    migrate.run()


# ---------- BAD strategy must oversell -------------------------------------

@pytest.mark.asyncio
async def test_pg_no_lock_oversells(pg_conn):
    res = await workers.run_sale(strategy="pg_no_lock", buyers=25, stock_init=10)
    assert res["sold"] + res["oversold"] >= 11, res
    assert res["oversold"] > 0, "BAD strategy must demonstrate the bug"
    assert res["stock_after"] < 0, "stock should go negative under no-lock"


# ---------- FIXED strategies must NOT oversell -----------------------------

@pytest.mark.asyncio
async def test_pg_for_update_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="pg_for_update", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10
    assert res["stock_after"] == 0


@pytest.mark.asyncio
async def test_pg_serializable_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="pg_serializable", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10


@pytest.mark.asyncio
async def test_pg_optimistic_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="pg_optimistic", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10


@pytest.mark.asyncio
async def test_redis_decr_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="redis_decr", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10


@pytest.mark.asyncio
async def test_redis_watch_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="redis_watch", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10


@pytest.mark.asyncio
async def test_redis_setnx_pg_no_oversell(pg_conn):
    res = await workers.run_sale(strategy="redis_setnx_pg", buyers=25, stock_init=10)
    assert res["oversold"] == 0
    assert res["sold"] == 10


# ---------- runner mechanics -----------------------------------------------

@pytest.mark.asyncio
async def test_run_inserts_run_log_row_and_returns_timeline(pg_conn):
    before = _run_log_count(pg_conn)
    res = await workers.run_sale(strategy="pg_for_update", buyers=5, stock_init=2)
    assert _run_log_count(pg_conn) == before + 1
    assert len(res["timeline"]) == 5
    assert res["id"] is not None


@pytest.mark.asyncio
async def test_unknown_strategy_raises(pg_conn):
    with pytest.raises(ValueError):
        await workers.run_sale(strategy="bogus", buyers=1, stock_init=1)


# ---------- helpers --------------------------------------------------------

def _run_log_count(pg_conn) -> int:
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM m4_concurrency.run_log")
        return cur.fetchone()[0]
