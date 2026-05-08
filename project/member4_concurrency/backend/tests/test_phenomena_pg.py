"""Phase 2 — concurrency-claim assertions on the phenomena lab.

Each phenomenon has a 'bad' config that reproduces the bug and a 'fix' that
prevents it. Tests drive RunRegistry directly (no HTTP) for determinism.
"""
from concurrent.futures import ThreadPoolExecutor

import pytest

import migrate
from workers import RunRegistry


def _run_all_serial(reg: RunRegistry, run_id: str) -> list[dict]:
    """Run every step in declared order. Suitable when no step blocks."""
    out = []
    for i in range(reg.step_count(run_id)):
        out.append(reg.run_step(run_id, i))
    return out


def _counter(pg_conn, name: str) -> int:
    with pg_conn.cursor() as cur:
        cur.execute("SELECT value FROM m4_concurrency.demo_counter WHERE name=%s", (name,))
        return cur.fetchone()[0]


def _balance(pg_conn, account_id: str) -> int:
    with pg_conn.cursor() as cur:
        cur.execute("SELECT balance FROM m4_concurrency.accounts WHERE account_id=%s", (account_id,))
        return cur.fetchone()[0]


# ---------------- lost update ---------------------------------------------

def test_lost_update_under_rc_no_lock_loses_one(pg_conn, reset_m4):
    """RC + no FOR UPDATE: S2's UPDATE blocks until S1 commits, then writes
    a stale value (read_v + 1 = 1) — so the final counter is 1 not 2."""
    import time
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="lost_update", isolation="read_committed", lock_mode="none")
    with ThreadPoolExecutor(max_workers=2) as pool:
        reg.run_step(rid, 0)               # S1 SELECT
        reg.run_step(rid, 1)               # S2 SELECT
        reg.run_step(rid, 2)               # S1 UPDATE — locks row
        f3 = pool.submit(reg.run_step, rid, 3)  # S2 UPDATE — blocks
        time.sleep(0.1)
        reg.run_step(rid, 4)               # S1 COMMIT — unblocks S2
        f3.result(timeout=5)
        reg.run_step(rid, 5)               # S2 COMMIT
    reg.abort(rid)
    assert _counter(pg_conn, "lu") == 1, "BUG demo: only one increment should survive"


def test_lost_update_with_for_update_keeps_both(pg_conn, reset_m4):
    """FOR UPDATE makes S2's SELECT block until S1 commits, so S2 reads the new value."""
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="lost_update", isolation="read_committed", lock_mode="for_update")
    # Order: S1 SELECT (idx 0), S2 SELECT (idx 1, BLOCKS), S1 UPDATE (idx 2),
    # S1 COMMIT (idx 4 unblocks S2), S2 UPDATE (idx 3), S2 COMMIT (idx 5).
    with ThreadPoolExecutor(max_workers=2) as pool:
        reg.run_step(rid, 0)             # S1 SELECT FOR UPDATE
        f_s2_select = pool.submit(reg.run_step, rid, 1)  # S2 SELECT FOR UPDATE — blocks
        reg.run_step(rid, 2)             # S1 UPDATE
        reg.run_step(rid, 4)             # S1 COMMIT — unblocks S2
        f_s2_select.result(timeout=5)    # S2 SELECT now returns post-commit value
        reg.run_step(rid, 3)             # S2 UPDATE
        reg.run_step(rid, 5)             # S2 COMMIT
    reg.abort(rid)
    assert _counter(pg_conn, "lu") == 2, "FIX demo: both increments must survive"


# ---------------- non-repeatable read --------------------------------------

def test_non_repeatable_read_under_rc(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="non_repeatable_read", isolation="read_committed")
    _run_all_serial(reg, rid)
    h = reg.state(rid)["sessions"][1]["history"]
    snap1, snap2 = h[0]["rows"][0][0], h[1]["rows"][0][0]
    reg.abort(rid)
    assert snap1 != snap2, f"under RC the second read should differ ({snap1} vs {snap2})"


def test_repeatable_read_freezes_snapshot(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="non_repeatable_read", isolation="repeatable_read")
    _run_all_serial(reg, rid)
    h = reg.state(rid)["sessions"][1]["history"]
    snap1, snap2 = h[0]["rows"][0][0], h[1]["rows"][0][0]
    reg.abort(rid)
    assert snap1 == snap2, "under REPEATABLE READ both reads must see the same snapshot"


# ---------------- phantom --------------------------------------------------

def test_phantom_under_rc_count_changes(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="phantom", isolation="read_committed")
    _run_all_serial(reg, rid)
    h = reg.state(rid)["sessions"][1]["history"]
    c1, c2 = h[0]["rows"][0][0], h[1]["rows"][0][0]
    reg.abort(rid)
    assert c2 > c1, f"phantom should increase the count under RC ({c1} → {c2})"


def test_phantom_under_repeatable_read_stable(pg_conn, reset_m4):
    """PG's RR is snapshot isolation — prevents phantoms (stronger than SQL standard)."""
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="phantom", isolation="repeatable_read")
    _run_all_serial(reg, rid)
    h = reg.state(rid)["sessions"][1]["history"]
    c1, c2 = h[0]["rows"][0][0], h[1]["rows"][0][0]
    reg.abort(rid)
    assert c1 == c2, "PG snapshot isolation should keep the count stable"


# ---------------- write skew -----------------------------------------------

def test_write_skew_under_repeatable_read_breaks_invariant(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="write_skew", isolation="repeatable_read")
    _run_all_serial(reg, rid)
    reg.abort(rid)
    # invariant was: alice + bob >= 1. Both went to 0 → broken.
    assert _balance(pg_conn, "alice") == 0
    assert _balance(pg_conn, "bob") == 0


def test_write_skew_under_serializable_aborts_one(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="write_skew", isolation="serializable")
    _run_all_serial(reg, rid)
    state = reg.state(rid)
    reg.abort(rid)
    # one of the two sessions must have errored with 40001 (serialization failure)
    errs = []
    for s in (1, 2):
        for h in state["sessions"][s]["history"]:
            if h.get("error"):
                errs.append(h["error"])
    assert any("40001" in e or "could not serialize" in e for e in errs), errs
    # invariant must be preserved (sum >= 1)
    assert _balance(pg_conn, "alice") + _balance(pg_conn, "bob") >= 1


# ---------------- deadlock -------------------------------------------------

def test_deadlock_raises_40P01_on_one_session(pg_conn, reset_m4):
    migrate.run()
    reg = RunRegistry()
    rid = reg.start(phenomenon="deadlock", isolation="read_committed")
    # Order: S1 lock alice (0), S2 lock bob (1), S1 try bob (2 — blocks),
    #        S2 try alice (3 — deadlock). PG kills one with 40P01.
    with ThreadPoolExecutor(max_workers=2) as pool:
        reg.run_step(rid, 0)
        reg.run_step(rid, 1)
        f_s1_b = pool.submit(reg.run_step, rid, 2)
        # let s1's UPDATE actually start blocking before s2 tries
        import time
        time.sleep(0.3)
        f_s2_a = pool.submit(reg.run_step, rid, 3)
        results = [f.result(timeout=10) for f in (f_s1_b, f_s2_a)]
    # rollbacks of remaining tx
    try:
        reg.run_step(rid, 4)
    except Exception:
        pass
    try:
        reg.run_step(rid, 5)
    except Exception:
        pass
    reg.abort(rid)
    errs = [r["error"] for r in results if r.get("error")]
    assert any("40P01" in e or "deadlock detected" in e for e in errs), results


# ---------------- HTTP smoke ------------------------------------------------

def test_phenomena_pg_http_surface(pg_conn, reset_m4):
    """Smoke: API endpoints present and consistent. Race orchestration is
    verified directly via RunRegistry — driving it through httpx Sync TestClient
    would require multiple httpx clients to truly interleave, which adds
    complexity without strengthening the concurrency claim."""
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    # list phenomena
    r = client.get("/api/concurrency/pheno/pg/phenomena")
    assert r.status_code == 200
    assert "lost_update" in r.json()["phenomena"]
    # start
    r = client.post(
        "/api/concurrency/pheno/pg/start",
        json={"phenomenon": "lost_update", "isolation": "read_committed", "lock_mode": "none"},
    )
    assert r.status_code == 200, r.text
    rid = r.json()["run_id"]
    assert r.json()["step_count"] == 7
    # state
    r = client.get(f"/api/concurrency/pheno/pg/{rid}/state")
    assert r.status_code == 200
    assert r.json()["phenomenon"] == "lost_update"
    # abort
    r = client.post(f"/api/concurrency/pheno/pg/{rid}/abort")
    assert r.status_code == 200
