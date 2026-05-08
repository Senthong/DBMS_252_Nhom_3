"""Step definitions for the Postgres phenomena lab.

Each phenomenon is a function taking knobs (isolation, lock_mode) and returning
an ordered list of `Step`. Steps fall into three kinds:

  - sql: cursor.execute(sql, merged_params); optionally remember a fetched value.
  - commit: conn.commit() on the named session.
  - rollback: conn.rollback() on the named session.

Sessions are referred to by integer id (1 or 2). The runtime in workers.py
holds one psycopg2 connection per (run_id, session) and dispatches each step
to the right connection.
"""
from dataclasses import dataclass, field
from typing import Callable

PHENOMENA = (
    "lost_update",
    "non_repeatable_read",
    "phantom",
    "write_skew",
    "deadlock",
)


@dataclass
class Step:
    session: int
    kind: str  # "sql" | "commit" | "rollback"
    sql: str = ""
    params: dict = field(default_factory=dict)
    remember: str | None = None  # bind first column of first row to this name
    label: str = ""

    def with_label(self, label: str) -> "Step":
        self.label = label
        return self


# ---- builders ---------------------------------------------------------------


def _lost_update(lock_mode: str) -> list[Step]:
    fu = " FOR UPDATE" if lock_mode == "for_update" else ""
    return [
        Step(1, "sql", f"SELECT value FROM m4_concurrency.demo_counter WHERE name='lu'{fu}",
             remember="v1", label="S1 SELECT counter"),
        Step(2, "sql", f"SELECT value FROM m4_concurrency.demo_counter WHERE name='lu'{fu}",
             remember="v2", label="S2 SELECT counter"),
        Step(1, "sql",
             "UPDATE m4_concurrency.demo_counter SET value = %(v1)s + 1 "
             "WHERE name='lu' RETURNING value",
             label="S1 UPDATE = v1+1"),
        Step(2, "sql",
             "UPDATE m4_concurrency.demo_counter SET value = %(v2)s + 1 "
             "WHERE name='lu' RETURNING value",
             label="S2 UPDATE = v2+1"),
        Step(1, "commit", label="S1 COMMIT"),
        Step(2, "commit", label="S2 COMMIT"),
        Step(2, "sql", "SELECT value FROM m4_concurrency.demo_counter WHERE name='lu'",
             label="VERIFY final value"),
    ]


def _non_repeatable_read(_lock_mode: str) -> list[Step]:
    return [
        Step(1, "sql",
             "SELECT balance FROM m4_concurrency.accounts WHERE account_id='alice'",
             label="S1 SELECT alice.balance (1st)"),
        Step(2, "sql",
             "UPDATE m4_concurrency.accounts SET balance=42 WHERE account_id='alice'",
             label="S2 UPDATE alice.balance=42"),
        Step(2, "commit", label="S2 COMMIT"),
        Step(1, "sql",
             "SELECT balance FROM m4_concurrency.accounts WHERE account_id='alice'",
             label="S1 SELECT alice.balance (2nd)"),
        Step(1, "commit", label="S1 COMMIT"),
    ]


def _phantom(_lock_mode: str) -> list[Step]:
    return [
        Step(1, "sql",
             "SELECT COUNT(*) FROM m4_concurrency.accounts WHERE color='B'",
             label="S1 COUNT B (1st)"),
        Step(2, "sql",
             "INSERT INTO m4_concurrency.accounts(account_id,color,balance) "
             "VALUES ('phantom-1','B',1) ON CONFLICT DO NOTHING",
             label="S2 INSERT phantom B"),
        Step(2, "commit", label="S2 COMMIT"),
        Step(1, "sql",
             "SELECT COUNT(*) FROM m4_concurrency.accounts WHERE color='B'",
             label="S1 COUNT B (2nd)"),
        Step(1, "commit", label="S1 COMMIT"),
    ]


def _write_skew(_lock_mode: str) -> list[Step]:
    """Both sessions verify sum>=1, then both zero out 'their' account.

    Under RR snapshot, both pass the check on a stale snapshot; both commit;
    sum = 0 — invariant broken.
    Under SERIALIZABLE, SSI detects the dangerous structure and aborts one
    with SQLSTATE 40001.
    """
    return [
        Step(1, "sql",
             "SELECT SUM(balance) FROM m4_concurrency.accounts "
             "WHERE account_id IN ('alice','bob')",
             label="S1 verify SUM>=1"),
        Step(2, "sql",
             "SELECT SUM(balance) FROM m4_concurrency.accounts "
             "WHERE account_id IN ('alice','bob')",
             label="S2 verify SUM>=1"),
        Step(1, "sql",
             "UPDATE m4_concurrency.accounts SET balance=0 "
             "WHERE account_id='alice' RETURNING balance",
             label="S1 UPDATE alice=0"),
        Step(2, "sql",
             "UPDATE m4_concurrency.accounts SET balance=0 "
             "WHERE account_id='bob' RETURNING balance",
             label="S2 UPDATE bob=0"),
        Step(1, "commit", label="S1 COMMIT"),
        Step(2, "commit", label="S2 COMMIT"),
        Step(2, "sql",
             "SELECT SUM(balance) FROM m4_concurrency.accounts "
             "WHERE account_id IN ('alice','bob')",
             label="VERIFY final SUM"),
    ]


def _deadlock(_lock_mode: str) -> list[Step]:
    return [
        Step(1, "sql",
             "UPDATE m4_concurrency.accounts SET balance=balance WHERE account_id='alice'",
             label="S1 lock alice"),
        Step(2, "sql",
             "UPDATE m4_concurrency.accounts SET balance=balance WHERE account_id='bob'",
             label="S2 lock bob"),
        Step(1, "sql",
             "UPDATE m4_concurrency.accounts SET balance=balance WHERE account_id='bob'",
             label="S1 try bob (blocks)"),
        Step(2, "sql",
             "UPDATE m4_concurrency.accounts SET balance=balance WHERE account_id='alice'",
             label="S2 try alice (deadlock)"),
        Step(1, "rollback", label="S1 ROLLBACK"),
        Step(2, "rollback", label="S2 ROLLBACK"),
    ]


_BUILDERS: dict[str, Callable[[str], list[Step]]] = {
    "lost_update": _lost_update,
    "non_repeatable_read": _non_repeatable_read,
    "phantom": _phantom,
    "write_skew": _write_skew,
    "deadlock": _deadlock,
}


def build_steps(phenomenon: str, lock_mode: str = "none") -> list[Step]:
    if phenomenon not in _BUILDERS:
        raise ValueError(f"unknown phenomenon: {phenomenon!r}")
    return _BUILDERS[phenomenon](lock_mode)


def list_phenomena() -> list[str]:
    return list(PHENOMENA)
