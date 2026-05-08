"""Phase 1 RED: /admin/seed + /admin/reset behavior."""
from fastapi.testclient import TestClient

import migrate
from main import app

client = TestClient(app)


def test_admin_seed_is_idempotent(pg_conn, reset_m4):
    r1 = client.post("/api/concurrency/admin/seed")
    r2 = client.post("/api/concurrency/admin/seed")
    assert r1.status_code == 200
    assert r2.status_code == 200
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM m4_concurrency.product_stock")
        assert cur.fetchone()[0] == 1


def test_admin_reset_truncates_run_log_and_restores_stock(pg_conn, reset_m4):
    migrate.run()
    with pg_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO m4_concurrency.run_log "
            "(strategy,buyers,initial_stock,sold,oversold,elapsed_ms,p99_ms) "
            "VALUES ('x',1,1,1,0,0,0)"
        )
        cur.execute("UPDATE m4_concurrency.product_stock SET stock=0, version=99")
        cur.execute("UPDATE m4_concurrency.accounts SET balance=42")
    r = client.post("/api/concurrency/admin/reset")
    assert r.status_code == 200
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM m4_concurrency.run_log")
        assert cur.fetchone()[0] == 0
        cur.execute("SELECT stock, version FROM m4_concurrency.product_stock")
        assert cur.fetchone() == (10, 0)
        cur.execute("SELECT balance FROM m4_concurrency.accounts")
        assert {row[0] for row in cur.fetchall()} == {1}
