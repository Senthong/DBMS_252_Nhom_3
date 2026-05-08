"""Phase 5 — inspection endpoint smoke tests against live PG + Redis."""
import threading
import time

import pytest
from fastapi.testclient import TestClient

import migrate
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset(reset_m4):
    migrate.run()
    yield


def test_pg_locks_lists_held_lock_during_for_update(pg_conn_factory):
    """Hold a row lock in a side connection — endpoint should see it."""
    side = pg_conn_factory(autocommit=False)
    holder_started = threading.Event()
    release = threading.Event()

    def hold():
        with side.cursor() as cur:
            cur.execute(
                "SELECT * FROM m4_concurrency.product_stock LIMIT 1 FOR UPDATE"
            )
            cur.fetchone()
        holder_started.set()
        release.wait(timeout=5)
        side.rollback()

    t = threading.Thread(target=hold)
    t.start()
    try:
        holder_started.wait(timeout=2)
        time.sleep(0.05)  # let pg_locks settle
        r = client.get("/api/concurrency/inspect/pg/locks")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert any("product_stock" in (row.get("relation") or "") for row in rows), rows
    finally:
        release.set()
        t.join(timeout=2)


def test_pg_activity_returns_list():
    r = client.get("/api/concurrency/inspect/pg/activity")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_redis_clients_lists_at_least_one_connection():
    r = client.get("/api/concurrency/inspect/redis/clients")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 1
    # CLIENT LIST always includes addr + id fields
    assert "addr" in rows[0] and "id" in rows[0]
