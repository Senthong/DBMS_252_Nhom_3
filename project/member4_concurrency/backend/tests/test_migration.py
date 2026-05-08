"""Phase 1 RED: assertions about migrate.run() behavior."""
import migrate


def _table_exists(conn, schema: str, name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema=%s AND table_name=%s",
            (schema, name),
        )
        return cur.fetchone() is not None


def test_tables_exist_after_migrate(pg_conn, reset_m4):
    migrate.run()
    for t in ("product_stock", "accounts", "run_log"):
        assert _table_exists(pg_conn, "m4_concurrency", t), f"missing m4_concurrency.{t}"


def test_seed_picks_real_product_with_stock_10(pg_conn, reset_m4):
    migrate.run()
    with pg_conn.cursor() as cur:
        cur.execute("SELECT product_id, stock, version FROM m4_concurrency.product_stock")
        rows = cur.fetchall()
    assert len(rows) == 1, "expect single seeded stock row"
    pid, stock, version = rows[0]
    assert stock == 10
    assert version == 0
    with pg_conn.cursor() as cur:
        cur.execute("SELECT 1 FROM public.products WHERE product_id=%s", (pid,))
        assert cur.fetchone() is not None, "seeded product_id must exist in public.products"


def test_seed_inserts_alice_and_bob(pg_conn, reset_m4):
    migrate.run()
    with pg_conn.cursor() as cur:
        cur.execute("SELECT account_id, color, balance FROM m4_concurrency.accounts ORDER BY account_id")
        rows = cur.fetchall()
    assert rows == [("alice", "B", 1), ("bob", "W", 1)]


def test_migration_is_idempotent(pg_conn, reset_m4):
    migrate.run()
    migrate.run()  # second call must not error or duplicate rows
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM m4_concurrency.product_stock")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM m4_concurrency.accounts")
        assert cur.fetchone()[0] == 2
