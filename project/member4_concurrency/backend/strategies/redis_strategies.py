"""Redis buy strategies — async, share one client per call.

The 'redis_setnx_pg' strategy is the practical real-world model: a Redis-held
mutex protects a Postgres write, mixing the cheap Redis path with PG durability.
"""
from __future__ import annotations

import asyncio
import uuid
from time import perf_counter

import redis.asyncio as aioredis
from redis.exceptions import WatchError

from database import REDIS_URL
from strategies.pg import buy_pg_no_lock

STOCK_KEY = "m4:stock"
LOCK_KEY = "m4:lock:stock"


def _client():
    return aioredis.from_url(REDIS_URL, decode_responses=True)


async def seed_redis_stock(stock: int) -> None:
    r = _client()
    try:
        await r.set(STOCK_KEY, stock)
    finally:
        await r.aclose()


def _ms_since(t0: float) -> float:
    return (perf_counter() - t0) * 1000.0


async def buy_redis_decr(_product_id: str, key: str = STOCK_KEY) -> tuple[str, float]:
    """FIX: DECR is atomic. Compensate with INCR if we crossed below zero."""
    t0 = perf_counter()
    r = _client()
    try:
        after = await r.decr(key)
        if after < 0:
            await r.incr(key)
            return "rejected", _ms_since(t0)
        return "sold", _ms_since(t0)
    finally:
        await r.aclose()


async def buy_redis_watch(_product_id: str, key: str = STOCK_KEY,
                           max_retries: int = 50) -> tuple[str, float]:
    """FIX: WATCH/MULTI/EXEC optimistic loop."""
    t0 = perf_counter()
    r = _client()
    try:
        for _ in range(max_retries):
            async with r.pipeline(transaction=True) as pipe:
                try:
                    await pipe.watch(key)
                    v = int(await pipe.get(key) or 0)
                    if v <= 0:
                        await pipe.unwatch()
                        return "rejected", _ms_since(t0)
                    pipe.multi()
                    pipe.decr(key)
                    await pipe.execute()
                    return "sold", _ms_since(t0)
                except WatchError:
                    continue
        return "rejected", _ms_since(t0)
    finally:
        await r.aclose()


async def buy_redis_setnx_pg(product_id: str, lock_key: str = LOCK_KEY,
                              lock_px_ms: int = 500) -> tuple[str, float]:
    """Mixed model: Redis-held mutex protects a PG read-modify-write.

    Real-world pattern when you want PG durability without paying for FOR UPDATE
    contention on hot rows. The PG branch reuses the no-lock body — the mutex
    is the safety guarantee.
    """
    t0 = perf_counter()
    r = _client()
    token = uuid.uuid4().hex
    try:
        # spin until acquire
        for _ in range(2000):
            ok = await r.set(lock_key, token, nx=True, px=lock_px_ms)
            if ok:
                break
            await asyncio.sleep(0.001)
        else:
            return "rejected", _ms_since(t0)
        try:
            outcome, _ = await asyncio.to_thread(buy_pg_no_lock, product_id)
            return outcome, _ms_since(t0)
        finally:
            # release only if we still own it (cheap CAS-via-Lua omitted for clarity)
            current = await r.get(lock_key)
            if current == token:
                await r.delete(lock_key)
    finally:
        await r.aclose()
