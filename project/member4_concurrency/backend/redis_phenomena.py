"""Redis-side concurrency demos. All run on redis.asyncio so coroutines
truly overlap (the sync redis client + asyncio.gather just serializes)."""
from __future__ import annotations

import asyncio

from redis.exceptions import WatchError

import redis.asyncio as aioredis

from database import REDIS_URL


def _client():
    """Fresh async redis client. Each demo invocation gets its own connection
    so we don't share state across event loops (matters in tests)."""
    return aioredis.from_url(REDIS_URL, decode_responses=True)


async def atomic_incr_demo(n: int = 100, key: str = "m4:incr") -> dict:
    r = _client()
    try:
        await r.delete(key)
        await asyncio.gather(*[r.incr(key) for _ in range(n)])
        final = int(await r.get(key) or 0)
    finally:
        await r.aclose()
    return {"n": n, "final": final, "lost": n - final, "construct": "INCR"}


async def non_atomic_set_demo(n: int = 50, delay_ms: int = 5, key: str = "m4:nas") -> dict:
    """Read / sleep / write — classic lost-update under concurrency."""
    r = _client()
    try:
        await r.set(key, 0)

        async def task():
            v = int(await r.get(key) or 0)
            await asyncio.sleep(delay_ms / 1000)
            await r.set(key, v + 1)

        await asyncio.gather(*[task() for _ in range(n)])
        final = int(await r.get(key) or 0)
    finally:
        await r.aclose()
    return {
        "n": n,
        "final": final,
        "lost": n - final,
        "delay_ms": delay_ms,
        "construct": "GET / sleep / SET",
    }


async def watch_demo(n: int = 20, key: str = "m4:watch") -> dict:
    """WATCH + MULTI/EXEC — abort + retry on concurrent change."""
    r = _client()
    retries = 0
    try:
        await r.set(key, 0)
        retries_lock = asyncio.Lock()

        async def task():
            nonlocal retries
            while True:
                async with r.pipeline(transaction=True) as pipe:
                    try:
                        await pipe.watch(key)
                        v = int(await pipe.get(key) or 0)
                        pipe.multi()
                        pipe.set(key, v + 1)
                        res = await pipe.execute()
                        if res is not None:
                            return
                        async with retries_lock:
                            retries += 1
                    except WatchError:
                        async with retries_lock:
                            retries += 1
                        continue

        await asyncio.gather(*[task() for _ in range(n)])
        final = int(await r.get(key) or 0)
    finally:
        await r.aclose()
    return {
        "n": n,
        "final": final,
        "lost": n - final,
        "retries": retries,
        "construct": "WATCH + MULTI/EXEC",
    }


async def setnx_mutex_demo(px_ms: int = 200, key: str = "m4:mutex") -> dict:
    r = _client()
    try:
        await r.delete(key)
        first = await r.set(key, "owner-A", nx=True, px=px_ms)
        second = await r.set(key, "owner-B", nx=True, px=px_ms)
        await asyncio.sleep((px_ms + 50) / 1000)
        third = await r.set(key, "owner-C", nx=True, px=px_ms)
    finally:
        await r.aclose()
    return {
        "first_acquired": bool(first),
        "second_blocked": not bool(second),
        "third_after_expiry": bool(third),
        "px_ms": px_ms,
        "construct": "SET NX PX",
    }
