# Member 4 — Concurrency Control: Demo & Implementation Plan

> Branch: `member4-concurrency` · Topic V (Concurrency Control) · DBMSs compared: **PostgreSQL 15** vs **Redis 7**

---

## 1. Assignment requirements that bind this part

From `Assignment_HK252.pdf` (DBMS HK252):

- Each member studies **one topic across two DBMSs (SQL vs NoSQL)** and **compares results** to recommend a fit. → My pair: **Postgres ↔ Redis**.
- Group must build one application with **≥ 2 × 5 = 10 functional requirements** (excluding login) and exercise all eight query/update types: insert, delete, update, single-cond query, composite-cond query, join, subquery, aggregate. My share is roughly 2 functional requirements demonstrating concurrency, plus contributing query/update coverage.
- Assessment weights: Demonstration 30 %, Application 30 %, Report/Presentation/Structure/Teamwork 10 % each.
- Bonus up to 2 points if extra theory **+** practice fully integrated in the app.
- Top-band rubric: GUIs user-friendly, all topics demonstrated correctly, both DBMSs shown.

**Implications for Member 4:**
1. Every concurrency phenomenon I demo on Postgres must have a Redis counterpart (or honest "N/A — single-thread").
2. UI must be clear enough for instructor to follow live, not just JSON dumps.
3. Demo must show **race in motion** (≥ 2 sessions actually fighting), not single-shot SQL output.

---

## 2. Inventory of current state

### 2.1 Branch / repo

- Branch `member4-concurrency` off `main`; carries fix to `shared/schemas/00_init_schemas.sql` (column rename `customer_zip_code → customer_zip_code_prefix`, composite PK on `order_reviews`) needed for Olist CSV loader.
- Olist CSVs already in `project/shared/init_db/data/` (9 files).

### 2.2 Database state (verified live)

| Table              | Rows    |
|--------------------|---------|
| customers          | 99 441  |
| sellers            |  3 095  |
| products           | 32 951  |
| orders             | 99 441  |
| order_items        | 112 650 |
| order_payments     | 103 886 |
| order_reviews      | 99 224  |

Schemas: `public`, `m1_indexing`, `m2_query`, `m3_transaction`, **`m4_concurrency`** (mine, empty), `m5_backup`. Redis up, `PING → PONG`.

### 2.3 Existing scaffold (to be replaced)

- `backend/main.py` — FastAPI app, mounts `routers/concurrency` under `/api/concurrency`. Keep.
- `backend/database.py` — SQLAlchemy engine + Redis client via `DATABASE_URL`/`REDIS_URL`. Keep.
- `backend/routers/concurrency.py` — 4 toy endpoints (`/active-locks`, `/isolation-demo/{level}`, `/redis-lock/{resource}`, `/deadlock-info`). **None of them actually race two sessions.** Replace.
- `frontend/src/App.jsx` — three tailwind cards calling those stubs. Replace with real demo UI.
- Dockerfile, vite config, package.json — fine as-is.

### 2.4 Cross-member coordination

- `member3_transaction` writes rows like `customer_id='demo-customer-001'`, `order_status='demo_commit'` into `public.orders`. **Don't filter or delete these.** I'll keep all my mutable demo state inside `m4_concurrency.*` so I never touch member 3's demo rows.
- All five member API prefixes are isolated (`/api/concurrency` is mine). No conflict.

---

## 3. Demo strategy (option C: phenomena tour + scenario sim)

Two flagship UI sections, both backed by the same DB.

### 3.1 Section A — "Concurrency Phenomena Lab" (academic tour)

For each phenomenon: side-by-side **Session 1** and **Session 2** panels. User clicks numbered "Step" buttons in order; UI shows what each session sees and the final committed state. Toggle isolation level / lock mode and re-run; outcome changes visibly.

Phenomena to demo on **Postgres**:

| # | Phenomenon            | "Bad" config             | "Fix" config(s)                         | What user sees                                       |
|---|-----------------------|--------------------------|------------------------------------------|------------------------------------------------------|
| 1 | Lost update           | RC, no lock              | `SELECT … FOR UPDATE` / SERIALIZABLE     | counter ends at 9 (bad) vs 10 (fixed)                |
| 2 | Dirty read            | n/a in PG                | (explain why PG can't dirty-read)        | textual explanation panel + proof query              |
| 3 | Non-repeatable read   | READ COMMITTED           | REPEATABLE READ                          | S1 sees row change mid-tx vs stays frozen            |
| 4 | Phantom read          | READ COMMITTED           | REPEATABLE READ (PG's RR is snapshot, prevents phantoms — stronger than SQL standard) | S1 count() differs vs stays stable                   |
| 5 | Write skew            | REPEATABLE READ          | SERIALIZABLE (SSI)                       | both sessions commit invalid invariant vs one aborts |
| 6 | Deadlock              | two crossed locks        | (PG auto-detects, kills one)             | S2 receives `40P01 deadlock_detected`                |
| 7 | Lock waits            | long FOR UPDATE          | shorter / `NOWAIT` / `SKIP LOCKED`       | live `pg_locks` + `pg_stat_activity` table           |

Redis counterparts (each pheno gets a "Redis pane"):

| # | Postgres pheno          | Redis behavior                                           |
|---|--------------------------|----------------------------------------------------------|
| 1 | Lost update              | `INCR` is atomic — never lost. `SET` without WATCH = lost.|
| 2 | Dirty read               | N/A: single-threaded command loop.                      |
| 3 | Non-repeatable read      | N/A: no transactions across reads. WATCH gives optimistic.|
| 4 | Phantom read             | N/A. SCAN is non-snapshot — show the divergence.        |
| 5 | Write skew               | WATCH + MULTI/EXEC retries; show abort on contention.   |
| 6 | Deadlock                 | Impossible (no multi-key locking). Distributed mutex via SET NX has TTL only. |
| 7 | Lock waits               | `CLIENT LIST` shows per-conn `idle` seconds — coarse only. |

### 3.2 Section B — "Flash Sale Simulator" (realistic scenario)

One Olist product picked from `public.products`. We give it limited stock in `m4_concurrency.product_stock`. UI lets user:
- pick *N* concurrent buyers (slider 1–50) and stock *S* (e.g. 10),
- pick a strategy from a dropdown:
  - PG / no-lock
  - PG / `SELECT … FOR UPDATE`
  - PG / SERIALIZABLE + retry
  - PG / optimistic locking via `version` column + `UPDATE … WHERE version = ?`
  - Redis / `DECR` atomic
  - Redis / `WATCH` + MULTI/EXEC
  - Redis / `SET NX PX` mutex around a PG update (mixed model — common in production)
- click **Run sale** → backend spawns *N* tasks against the chosen strategy.

Output:
- timeline chart (which buyer succeeded, when),
- final stock count, **oversells** (how many sold past 0),
- p50/p99 latency,
- a comparison table that accumulates rows across runs (one row per strategy) so the report writes itself.

### 3.3 Why C, not just A or B

A alone reads like a textbook — strong on theory but weak on "application" rubric (30 %). B alone is fun but glosses isolation/lock details — weak on demonstration. C fits the **bonus rule**: "additional/excellent work from theoretical and practical perspectives, completely included in the application" → up to **+2 pts**.

---

## 4. Data model additions

All new tables in `m4_concurrency.*`. Migration file: `backend/migrations/001_init.sql`, applied at backend startup if missing (idempotent `CREATE TABLE IF NOT EXISTS`).

```sql
-- limited stock per product, isolated from real Olist data
CREATE TABLE IF NOT EXISTS m4_concurrency.product_stock (
    product_id  VARCHAR(50) PRIMARY KEY REFERENCES public.products(product_id),
    stock       INT NOT NULL CHECK (stock >= 0),
    version     INT NOT NULL DEFAULT 0,        -- for optimistic locking demo
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- paired account ledger for write-skew demo (classic black/white marbles)
CREATE TABLE IF NOT EXISTS m4_concurrency.accounts (
    account_id  VARCHAR(20) PRIMARY KEY,
    color       CHAR(1) NOT NULL CHECK (color IN ('B','W')),
    balance     INT NOT NULL
);

-- demo-run audit (every flash-sale run logged for the comparison table)
CREATE TABLE IF NOT EXISTS m4_concurrency.run_log (
    id          SERIAL PRIMARY KEY,
    started_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    strategy    VARCHAR(40) NOT NULL,
    buyers      INT NOT NULL,
    initial_stock INT NOT NULL,
    sold        INT NOT NULL,
    oversold    INT NOT NULL,
    elapsed_ms  INT NOT NULL,
    p99_ms      INT NOT NULL,
    notes       TEXT
);
```

Seed: pick 1 product (e.g. the highest-volume one in `order_items`), give it stock 10. Reset endpoint repopulates between runs.

For the phenomena lab, additional fixed rows:
- `m4_concurrency.accounts`: `('alice','B',1)`, `('bob','W',1)` — write-skew demo.
- A "counter row" in `product_stock` reused for lost-update demo.

---

## 5. Backend API design

Replace `routers/concurrency.py` with three thin routers, plus a worker pool.

```
backend/
  main.py
  database.py
  migrations/001_init.sql
  workers.py                 # async runner, spawns concurrent buyers
  routers/
    phenomena_pg.py          # /api/concurrency/pheno/pg/*
    phenomena_redis.py       # /api/concurrency/pheno/redis/*
    scenario.py              # /api/concurrency/sale/*
    inspect.py               # /api/concurrency/inspect/* (locks, activity)
    admin.py                 # /api/concurrency/admin/reset, /seed
```

### 5.1 Phenomena lab endpoints (Postgres)

Pattern: each phenomenon is **stepwise**. UI sends `POST /pheno/pg/{name}/step` with `{session: 1|2, step: int, isolation: str, lock_mode: str}`. Backend keeps two long-lived `psycopg2` connections keyed by `(run_id, session)` in a process-local dict so one HTTP request doesn't end the transaction. Each step performs one SQL statement and returns: rows visible, last error, txid (`txid_current()`).

Endpoints:
- `POST /pheno/pg/start` → returns `run_id`, opens 2 connections.
- `POST /pheno/pg/{phenomenon}/step` (phenomenon ∈ {`lost_update`, `non_repeatable_read`, `phantom`, `write_skew`, `deadlock`}).
- `POST /pheno/pg/{run_id}/abort` → rollback both, close.
- `GET  /pheno/pg/{run_id}/state` → snapshot of both sessions' last visible state.

For tx-id display use `pg_current_xact_id()` (PG 13+); `txid_current()` still works but is the legacy name.

**Process-local registry caveat:** the connection dict lives in one Python process. Run uvicorn with `--workers 1` (default in dev) and the docker-compose backend container with a single worker, otherwise step 2 may land on a different worker than step 1 and miss the open connection. Document this in the README and in the FastAPI startup banner.

### 5.2 Phenomena lab endpoints (Redis)

Same pattern, Redis-flavored:
- `POST /pheno/redis/atomic-incr` (no lost update) vs `POST /pheno/redis/non-atomic-set` (lost update reproducible).
- `POST /pheno/redis/watch` (optimistic, retries shown).
- `POST /pheno/redis/setnx-mutex` (with TTL expiry behavior).

### 5.3 Scenario sim endpoints

- `POST /sale/seed` body `{product_id, stock}` — populates `product_stock` row.
- `POST /sale/run` body `{strategy, buyers, stock_init}` → spawns N concurrent buyer tasks. **psycopg2 is blocking**, so PG strategies must run inside a `ThreadPoolExecutor` (or wrap each call with `asyncio.to_thread`) to actually overlap; calling them directly under `asyncio.gather` will serialize on the GIL/event loop and the race won't reproduce. Redis strategies use `redis.asyncio` and can use `asyncio.gather` directly. Returns timeline + summary, writes a row to `run_log`.
- `GET  /sale/runs?limit=20` — last N runs for the comparison table.
- `POST /sale/reset` — TRUNCATE `run_log`, reset stock.

### 5.4 Inspection endpoints (live)

- `GET /inspect/pg/locks` — `pg_locks` join `pg_stat_activity` with mode, granted, query, wait_event.
- `GET /inspect/pg/activity` — non-idle backends.
- `GET /inspect/redis/clients` — `CLIENT LIST` + memory.

### 5.5 Coverage of required query/update types (for the group's app rubric)

The flash-sale + history feature exercises all eight query/update types:
- **insert** — `INSERT INTO m4_concurrency.run_log …` per run.
- **update** — `UPDATE m4_concurrency.product_stock SET stock = stock - 1 …` per buyer.
- **delete** — admin reset path (`DELETE FROM m4_concurrency.run_log` or `TRUNCATE`).
- **single-cond** — `SELECT * FROM run_log WHERE strategy = :s`.
- **composite-cond** — `SELECT * FROM run_log WHERE strategy = :s AND oversold = 0`.
- **join** — `SELECT ps.stock, p.product_category_name FROM m4_concurrency.product_stock ps JOIN public.products p USING (product_id)` (sale page header).
- **subquery** — `SELECT * FROM run_log WHERE id IN (SELECT MAX(id) FROM run_log GROUP BY strategy)` (latest run per strategy).
- **aggregate** — `SELECT strategy, AVG(p99_ms), AVG(oversold) FROM run_log GROUP BY strategy` (comparison view).

Single feature discharges Member 4's share of the eight types — confirm with team to avoid duplication.

---

## 6. Redis side — what to actually show

| Construct                | What it demonstrates                                      | Postgres analog               |
|--------------------------|-----------------------------------------------------------|-------------------------------|
| Single command (`INCR`)  | atomicity by virtue of single-thread loop                 | row-level lock implicit       |
| `MULTI` / `EXEC`         | command queue, all-or-nothing dispatch (NOT isolation)    | not equivalent to PG tx       |
| `WATCH` + `MULTI/EXEC`   | optimistic concurrency: abort if watched key changed      | `UPDATE … WHERE version = ?`  |
| `SET key val NX PX ms`   | distributed mutex with auto-expiry (Redlock prereq)       | advisory lock / `pg_try_advisory_lock` |
| `BLPOP` / streams        | producer-consumer queue (single-consumer-per-msg)         | `SELECT … FOR UPDATE SKIP LOCKED` queue |
| `EVAL` (Lua)             | true atomic compound op                                   | stored procedure in tx        |

Demo at least: `INCR`, `WATCH+MULTI/EXEC`, `SET NX PX`, and one Lua atomic decrement (bonus theory).

---

## 7. UI design

Stack: React 18 + Vite + Tailwind (already scaffolded) + a small charting lib for the timeline. Pick **`recharts`** (smaller, JSX-native) over Chart.js.

### 7.1 Layout

Top-level tabs (sticky header):
1. **Overview** — what concurrency is, what we'll show, links to other tabs. One paragraph + a diagram.
2. **Phenomena Lab** — 7 sub-tabs (one per phenomenon).
3. **Flash Sale Simulator** — single page.
4. **Live Inspection** — locks + activity, auto-refresh 1 s.
5. **Comparison Report** — auto-generated table (PG vs Redis per phenomenon) and run history bar chart.

### 7.2 Phenomena lab page (per phenomenon)

```
+----------------------------------------------------------------+
| Lost Update                                                    |
| Description:  ...one paragraph...                              |
| Toggles: [Isolation v] [Lock mode v]   [Reset]  [Run all steps]|
+--------------------------+---------------------------+
| Session 1                | Session 2                 |
| step1: BEGIN             | step1: BEGIN              |
| step2: SELECT bal        | step2: SELECT bal         |
| step3: UPDATE bal=bal+10 | step3: UPDATE bal=bal+10  |
| step4: COMMIT            | step4: COMMIT             |
| → bal seen: 100          | → bal seen: 100           |
| → final after commit: ?  | → blocked / committed     |
+--------------------------+---------------------------+
| Final committed state: bal = 110  ⚠ expected 120              |
| Verdict: LOST UPDATE detected                                  |
| ----------------- Redis comparison ----------------------      |
| INCR mybal twice → 102 (atomic, never lost)  ✅                 |
+----------------------------------------------------------------+
```

Each step button is **enabled in turn** so the audience watches the race unfold, not autoplay.

### 7.3 Flash sale page

```
[Strategy: PG no-lock ▾]  Buyers: ──●── 25   Stock: ── 10
                                                         [Run]

Timeline (first 60 attempts):
   ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ . . . . . . . . . . . .
   green = sold,  red = oversold,  grey = rejected

Result:
  sold: 13   oversold: 3   stock_after: -3   p99: 41ms
  ▶ added to comparison table

Comparison table (cumulative):
| strategy             | oversold | p99 | notes              |
| pg_no_lock           | 3        | 41  | lost updates seen   |
| pg_select_for_update | 0        | 86  | serialized          |
| pg_serializable      | 0        | 71  | 4 retries           |
| redis_decr           | 0        | 6   | atomic              |
| redis_watch          | 0        | 22  | 6 retries           |
| redis_setnx_pg       | 0        | 53  | mixed model         |
```

### 7.4 Live inspection

Auto-refresh every 1 s while open. Tables:
- **PG Locks**: pid, relation, mode, granted, blocked_by, query.
- **PG Activity**: pid, state, wait_event, query.
- **Redis Clients**: id, addr, idle, db.

### 7.5 Comparison report (the part that helps the report)

A Markdown-styled section the user can copy-paste into the team report. Auto-fills with results from the latest runs of each strategy. This is the bridge from app → written report.

---

## 8. Implementation phases

Track each phase as a separate commit. TDD where it makes sense (mostly worker logic + scenario aggregation). UI is exploratory — manual verification.

### Phase 0 — housekeeping (≤ 1 hr)
- [ ] Commit current schema fix on `member4-concurrency`.
- [ ] Add `.gitignore` entry for `project/shared/init_db/data/` so CSVs never get committed.

### Phase 1 — schema + seed (1–2 hrs)
- [ ] `backend/migrations/001_init.sql` (tables + seed).
- [ ] `database.py`: run migration on startup if absent.
- [ ] `routers/admin.py`: `/admin/seed`, `/admin/reset`.
- [ ] Smoke: `curl POST /admin/seed` → tables populated.

### Phase 2 — phenomena lab backend (4–6 hrs)
- [ ] Long-lived connection registry (`workers.py`, dict keyed by `run_id`).
- [ ] `routers/phenomena_pg.py` with 5 phenomena.
- [ ] `routers/phenomena_redis.py` with 4 endpoints.
- [ ] Unit tests using `psycopg2` directly to assert the bad config actually reproduces the bug (else the demo lies).

### Phase 3 — scenario sim backend (3–4 hrs)
- [ ] `routers/scenario.py` with 7 strategies (4 PG + 3 Redis).
- [ ] Concurrency runner: `ThreadPoolExecutor` for psycopg2 strategies (or `asyncio.to_thread`); `asyncio.gather` for `redis.asyncio` strategies. Picking the wrong one = no race.
- [ ] Latency capture (per-task `perf_counter`).
- [ ] `run_log` insert per run.

### Phase 4 — inspection + admin (1–2 hrs)
- [ ] `routers/inspect.py` (live locks/activity/clients).
- [ ] OpenAPI tags clean for `/docs`.

### Phase 5 — frontend shell (2–3 hrs)
- [ ] React Router routes for 5 tabs.
- [ ] Tailwind layout + sticky header.
- [ ] `recharts` install.
- [ ] Axios instance pointing to `/api/concurrency`.

### Phase 6 — phenomena lab UI (4–6 hrs)
- [ ] Reusable `<Stepper>` component (numbered buttons, advances state).
- [ ] One sub-page per phenomenon, all sharing the layout.
- [ ] Redis comparison pane per page.

### Phase 7 — flash sale UI (3–4 hrs)
- [ ] Strategy dropdown, sliders, run button.
- [ ] Timeline chart (recharts `BarChart` with discrete categories).
- [ ] Cumulative comparison table from `GET /sale/runs`.

### Phase 8 — live inspection UI + comparison report (2–3 hrs)
- [ ] 1 s polling hook with cleanup.
- [ ] Markdown export button on comparison page.

### Phase 9 — polish + docs (2 hrs)
- [ ] Update `member4_concurrency/README.md` with run instructions.
- [ ] Top-of-page "what to click during demo" cheat-sheet.
- [ ] Verify `docker-compose up --build` still works (nginx route `/concurrency/` and `/api/concurrency/`).
- [ ] Verify Vite `base: '/concurrency/'` so prod asset paths resolve.

**Total estimate: 25–35 hrs.** Cuttable: phases 8 polish, deadlock phenomenon (3.1 #6), Lua EVAL example.

---

## 9. Risks / things that will bite

1. **FastAPI's `get_db` returns a fresh session per request** — phenomena lab needs **persistent transactions across requests**. Solution: bypass `get_db`, use a registry of raw `psycopg2` connections keyed by `run_id`; register cleanup on FastAPI shutdown event so we don't leak. Document this clearly in code.
2. **`docker-compose down -v` wipes everything.** The schema/init script runs only on empty volume. `001_init.sql` for member 4 should NOT live in `shared/schemas/` because that's first-init-only — apply it from the backend at startup so `down -v` cycles still re-create m4 tables.
3. **CORS on dev**: Vite on `:3004` calling backend on `:8004` already covered (`allow_origins=['*']`).
4. **Production routing**: nginx serves SPAs from `/concurrency/`. Vite must build with `base: '/concurrency/'` or asset paths break in the prod image.
5. **Demo determinism**: a race demo that "sometimes works" is useless live. Need synthetic delays (`pg_sleep(0.2)` at the right point) so the race is reliably reproducible during presentation.
6. **Member 3 collision**: their tx demo reads/writes `public.orders`. I avoid `public.*` for mutation. Only **read** `public.products` for the seed.

---

## 10. References (cite these in the team report)

URLs intentionally omitted where I couldn't verify the exact path — search the doc title on the official site.

- PostgreSQL 15 docs, **Chapter 13 "Concurrency Control"** (isolation levels, MVCC, `pg_locks`, advisory locks). Root: postgresql.org/docs/15/.
- Cahill, Röhm, Fekete, *Serializable Isolation for Snapshot Databases* (SIGMOD 2008) — basis of PostgreSQL SSI.
- Kleppmann, *Designing Data-Intensive Applications*, Chapter 7 "Transactions" — phenomena taxonomy with diagrams.
- Vlad Mihalcea, blog series on ACID isolation phenomena (vladmihalcea.com).
- Redis docs, **"Transactions"** (WATCH / MULTI / EXEC) and **"Distributed locks with Redis"** (Redlock). Root: redis.io.
- Martin Fowler, *Patterns of Enterprise Application Architecture*, **Optimistic Offline Lock**.
- PostgreSQL Wiki, **"Serializable Snapshot Isolation"** page (wiki.postgresql.org).
- Jepsen analyses (jepsen.io) for postgres and redis — honest accounting of guarantees each DBMS does and does not offer under network/clock faults.

---

## 11. Open questions to confirm with team

1. Is React Router OK to add (`react-router-dom`) or should I keep one-page conditional render? (Recommend: add it.)
2. Is `recharts` acceptable or stick to plain SVG/CSS bars? (Recommend: recharts.)
3. Who in the team owns the report's "concurrency" chapter? I'll deliver the auto-generated comparison table; they prose-up the analysis.
4. Are we presenting from `docker-compose up --build` (prod nginx) or per-member dev servers? Affects the Vite `base` config decision.
