"""Strategy callables used by the flash-sale runner.

Each strategy takes the product_id of the seeded m4_concurrency.product_stock
row and returns (outcome, elapsed_ms). Outcome ∈ {"sold","oversold","rejected"}.

Postgres strategies are sync (psycopg2 is blocking). The runner wraps them in
asyncio.to_thread so concurrent buyers truly overlap rather than serialize on
the event loop.

Redis strategies are async on redis.asyncio so coroutines also overlap.
"""
from .pg import (
    buy_pg_no_lock,
    buy_pg_for_update,
    buy_pg_serializable,
    buy_pg_optimistic,
)
from .redis_strategies import (
    buy_redis_decr,
    buy_redis_watch,
    buy_redis_setnx_pg,
    seed_redis_stock,
)

PG_STRATEGIES = {
    "pg_no_lock": buy_pg_no_lock,
    "pg_for_update": buy_pg_for_update,
    "pg_serializable": buy_pg_serializable,
    "pg_optimistic": buy_pg_optimistic,
}

REDIS_STRATEGIES = {
    "redis_decr": buy_redis_decr,
    "redis_watch": buy_redis_watch,
    "redis_setnx_pg": buy_redis_setnx_pg,
}

ALL_STRATEGIES = list(PG_STRATEGIES) + list(REDIS_STRATEGIES)
