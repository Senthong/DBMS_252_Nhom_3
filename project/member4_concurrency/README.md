# Member 4 — Topic V: Concurrency Control

PostgreSQL 15 vs Redis 7, side by side. Reproduces the five canonical concurrency
phenomena live and benchmarks seven flash-sale strategies against the Olist dataset.

## Run

```bash
# from project/
docker-compose up postgres redis -d              # shared infra
python shared/init_db/load_dataset.py            # one-time CSV load (if needed)

# backend (port 8004)
cd member4_concurrency/backend
pip install uv
uv sync
uv run uvicorn main:app --reload --port 8004 --workers 1

# frontend (port 3004)
cd ../frontend
npm install && npm run dev
# open http://localhost:3004/concurrency/
```

Production mode: `cd project && docker-compose up --build` → http://localhost/concurrency/.

## Tests

All concurrency claims are asserted against live PG + Redis (no mocks):

```bash
cd backend && uv run pytest -v
```

32 tests; each phenomenon has both a *bad-config* test (must reproduce the bug)
and a *fix* test (must prevent it). If `test_pg_no_lock_oversells` ever passes
with `oversold == 0`, the demo is fake — the test guards against that.

## Demo cheat-sheet (≈10 minutes)

1. **Overview** — open `/concurrency/`, talk through what we'll show.
2. **Phenomena Lab → Lost Update** — Start run, click S1 step 1, S2 step 1, S1 steps 3+5, S2 steps 4+6 → counter ends at **1** (lost). Click *Apply fix* → counter ends at **2**.
3. **Phenomena Lab → Write Skew** — Start run with `repeatable_read` → both alice and bob go to 0 (invariant broken). Switch to `serializable` → one session aborts with `40001`.
4. **Phenomena Lab → Deadlock** — Start run, fire S1 step 1, S2 step 2, then S1 step 3 + S2 step 4 → one session errors with `40P01`.
5. **Flash Sale → pg_no_lock**, 25 buyers / 10 stock → see oversells in red. Then run `pg_for_update`, `redis_decr`, `redis_setnx_pg` → 0 oversells, varying p99.
6. **Live Inspection** — pop open while a sale is running to watch `pg_locks` and `pg_stat_activity` evolve.
7. **Comparison Report** — copy the auto-generated markdown into the team report.

## Strategies in the flash-sale simulator

| name              | DB    | mechanism                                       | oversells? |
|-------------------|-------|-------------------------------------------------|------------|
| `pg_no_lock`      | PG    | naive read-modify-write                         | **YES** (the bug) |
| `pg_for_update`   | PG    | `SELECT ... FOR UPDATE`                         | no |
| `pg_serializable` | PG    | `ISOLATION LEVEL SERIALIZABLE` + retry on 40001 | no |
| `pg_optimistic`   | PG    | `UPDATE ... WHERE version=v` + retry            | no |
| `redis_decr`      | Redis | atomic `DECR`, `INCR` on overshoot              | no |
| `redis_watch`     | Redis | `WATCH` + `MULTI/EXEC` optimistic loop          | no |
| `redis_setnx_pg`  | mixed | `SET NX PX` mutex around a PG update            | no |

## Notes / quirks

- **uvicorn must run with `--workers 1`** — the phenomena lab keeps long-lived
  `psycopg2` connections in a process-local registry; multiple workers would
  break stepping across HTTP requests.
- The `m4_concurrency.product_stock` table intentionally has no `CHECK (stock >= 0)`
  so the `pg_no_lock` strategy can demonstrate negative stock. The migration
  drops the constraint if it exists from older deployments.
- `time.sleep(0.002)` is baked into the bad code path so the race reproduces
  deterministically during a live demo.
- Switching tabs / phenomena fires `phenomena/pg/{rid}/abort` to release any
  held row locks — otherwise a leaked transaction would block the next sale.

## API surface (mounted under `/api/concurrency`)

```
admin/seed                  POST   apply migration + seed (idempotent)
admin/reset                 POST   truncate run_log + restore seed values
pheno/pg/phenomena          GET    list of supported phenomena
pheno/pg/start              POST   open 2 conns, return run_id + step list
pheno/pg/{rid}/step/{idx}   POST   run one step, return rows / error / txid
pheno/pg/{rid}/state        GET    snapshot
pheno/pg/{rid}/abort        POST   rollback + close
pheno/redis/atomic-incr     POST   N concurrent INCRs
pheno/redis/non-atomic-set  POST   GET/sleep/SET — reproduces lost update
pheno/redis/watch           POST   WATCH + MULTI/EXEC with retry counter
pheno/redis/setnx-mutex     POST   SET NX PX behavior + expiry
sale/strategies             GET    list strategies
sale/seed                   POST   set product_stock to N
sale/run                    POST   spawn N concurrent buyers
sale/runs                   GET    history (last 20)
sale/runs/by-strategy       GET    single-condition query
sale/runs/clean             GET    composite-condition (oversold = 0)
sale/runs/latest-per-strategy   GET   subquery
sale/runs/aggregate         GET    aggregate (avg p99, avg oversold per strategy)
sale/stock-info             GET    JOIN with public.products
sale/reset                  POST   delete + restore
inspect/pg/locks            GET    pg_locks + pg_stat_activity
inspect/pg/activity         GET    non-idle backends
inspect/redis/clients       GET    CLIENT LIST parsed
inspect/redis/info          GET    memory stats
```

## File layout

```
backend/
  main.py                 FastAPI app + lifespan migration hook
  database.py             SQLAlchemy engine, sync redis, async redis, raw psycopg2 factory
  migrate.py              001_init.sql + idempotent seed
  migrations/001_init.sql
  workers.py              RunRegistry (phenomena lab) + run_sale (flash sale)
  phenomena.py            step builders for each Postgres phenomenon
  redis_phenomena.py      async Redis demos
  strategies/             one callable per buy strategy (pg.py + redis_strategies.py)
  routers/
    admin.py phenomena_pg.py phenomena_redis.py scenario.py inspect.py
  tests/                  32 tests against live PG + Redis (no mocks)

frontend/src/
  App.jsx                 BrowserRouter, sticky tab header
  api.js                  axios → /api/concurrency
  pages/                  Overview, PhenomenaLab, FlashSale, Inspect, Compare
  components/             Stepper, SessionPanel
```
