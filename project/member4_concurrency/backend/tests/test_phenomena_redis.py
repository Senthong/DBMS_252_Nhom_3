"""Phase 3 — concurrency-claim assertions on the Redis side."""
import pytest

from redis_phenomena import (
    atomic_incr_demo,
    non_atomic_set_demo,
    watch_demo,
    setnx_mutex_demo,
)


@pytest.mark.asyncio
async def test_incr_is_atomic_under_concurrency(redis_client):
    redis_client.delete("m4:incr")
    out = await atomic_incr_demo(n=100)
    assert out["final"] == 100, "INCR is single-thread atomic — must never lose"
    assert out["lost"] == 0


@pytest.mark.asyncio
async def test_get_set_can_lose_updates(redis_client):
    """Naive GET/sleep/SET reproduces lost updates under concurrency."""
    redis_client.delete("m4:nas")
    out = await non_atomic_set_demo(n=50, delay_ms=5)
    assert out["final"] < 50, f"expected lost updates, got final={out['final']}"
    assert out["lost"] > 0


@pytest.mark.asyncio
async def test_watch_eventually_consistent_with_retries(redis_client):
    """Optimistic WATCH/MULTI/EXEC: aborted txs retry, no lost update."""
    redis_client.delete("m4:watch")
    out = await watch_demo(n=20)
    assert out["final"] == 20
    assert out["retries"] >= 1, "with N=20 concurrent watchers some retries must happen"


@pytest.mark.asyncio
async def test_setnx_mutex_blocks_second_then_unblocks_after_expiry(redis_client):
    redis_client.delete("m4:mutex")
    out = await setnx_mutex_demo(px_ms=150)
    assert out["first_acquired"] is True
    assert out["second_blocked"] is True
    assert out["third_after_expiry"] is True
