"""Pytest fixtures. Tests run against the live Postgres + Redis on localhost."""
import os
import pytest
import psycopg2
import redis as sync_redis

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/ecommerce")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


@pytest.fixture
def pg_conn():
    """Fresh autocommit connection — for setup/teardown SQL only."""
    c = psycopg2.connect(DATABASE_URL)
    c.autocommit = True
    try:
        yield c
    finally:
        c.close()


@pytest.fixture
def pg_conn_factory():
    """Factory yielding fresh non-autocommit connections (for race tests)."""
    opened = []

    def _new(autocommit: bool = False):
        c = psycopg2.connect(DATABASE_URL)
        c.autocommit = autocommit
        opened.append(c)
        return c

    yield _new
    for c in opened:
        try:
            c.rollback()
        except Exception:
            pass
        c.close()


@pytest.fixture
def redis_client():
    r = sync_redis.from_url(REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        r.close()


@pytest.fixture
def reset_m4(pg_conn, redis_client):
    """Drop m4 tables + flush relevant redis keys, so each test starts clean."""
    def _reset():
        with pg_conn.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS m4_concurrency.run_log CASCADE")
            cur.execute("DROP TABLE IF EXISTS m4_concurrency.accounts CASCADE")
            cur.execute("DROP TABLE IF EXISTS m4_concurrency.product_stock CASCADE")
            cur.execute("DROP TABLE IF EXISTS m4_concurrency.demo_counter CASCADE")
        for k in redis_client.scan_iter(match="m4:*"):
            redis_client.delete(k)
    _reset()
    yield _reset
    _reset()
