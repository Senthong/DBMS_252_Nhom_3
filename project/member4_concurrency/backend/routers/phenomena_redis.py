"""HTTP wrappers for the Redis phenomena demos."""
from fastapi import APIRouter, Query

from redis_phenomena import (
    atomic_incr_demo,
    non_atomic_set_demo,
    setnx_mutex_demo,
    watch_demo,
)

router = APIRouter()


@router.post("/atomic-incr")
async def atomic_incr(n: int = Query(100, ge=1, le=1000)):
    return await atomic_incr_demo(n=n)


@router.post("/non-atomic-set")
async def non_atomic_set(
    n: int = Query(50, ge=1, le=500),
    delay_ms: int = Query(5, ge=0, le=100),
):
    return await non_atomic_set_demo(n=n, delay_ms=delay_ms)


@router.post("/watch")
async def watch(n: int = Query(20, ge=1, le=200)):
    return await watch_demo(n=n)


@router.post("/setnx-mutex")
async def setnx_mutex(px_ms: int = Query(200, ge=10, le=2000)):
    return await setnx_mutex_demo(px_ms=px_ms)
