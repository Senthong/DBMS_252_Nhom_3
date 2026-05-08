"""Flash-sale scenario endpoints. Also exercises the eight required
query/update types — the report's coverage table maps to this router."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
import migrate
import workers
from strategies import ALL_STRATEGIES

router = APIRouter()


class SeedReq(BaseModel):
    stock: int = Field(default=10, ge=1, le=10_000)
    product_id: str | None = None


class RunReq(BaseModel):
    strategy: str
    buyers: int = Field(ge=1, le=200)
    stock_init: int = Field(ge=0, le=10_000)
    product_id: str | None = None


@router.get("/strategies")
def strategies():
    return {"strategies": ALL_STRATEGIES}


@router.post("/seed")
def seed(req: SeedReq):
    pid = req.product_id or workers.get_seeded_product_id()
    workers.reset_stock(pid, req.stock)
    return {"product_id": pid, "stock": req.stock}


@router.post("/run")
async def run(req: RunReq):
    try:
        return await workers.run_sale(
            strategy=req.strategy,
            buyers=req.buyers,
            stock_init=req.stock_init,
            product_id=req.product_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset")
def reset():
    migrate.reset_run_log_and_stock()
    return {"status": "reset"}


# ---- coverage of the eight required query/update types -------------------
# insert (run_log) and update (product_stock) happen inside /run.
# delete = TRUNCATE inside /reset.

@router.get("/runs")
def runs(limit: int = 20, db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT id, started_at, strategy, buyers, initial_stock, sold, oversold, "
        "elapsed_ms, p99_ms, notes FROM m4_concurrency.run_log "
        "ORDER BY id DESC LIMIT :lim"
    ), {"lim": limit}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/runs/by-strategy")
def runs_by_strategy(strategy: str, db: Session = Depends(get_db)):
    """Single-condition query."""
    rows = db.execute(text(
        "SELECT id, started_at, strategy, buyers, sold, oversold, p99_ms "
        "FROM m4_concurrency.run_log WHERE strategy = :s ORDER BY id DESC"
    ), {"s": strategy}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/runs/clean")
def runs_clean(strategy: str, db: Session = Depends(get_db)):
    """Composite-condition query — runs that finished without overselling."""
    rows = db.execute(text(
        "SELECT id, sold, oversold, p99_ms FROM m4_concurrency.run_log "
        "WHERE strategy = :s AND oversold = 0 ORDER BY id DESC"
    ), {"s": strategy}).mappings().all()
    return [dict(r) for r in rows]


@router.get("/stock-info")
def stock_info(db: Session = Depends(get_db)):
    """JOIN with public.products for the demo header."""
    rows = db.execute(text(
        "SELECT ps.product_id, ps.stock, ps.version, p.product_category_name "
        "FROM m4_concurrency.product_stock ps "
        "JOIN public.products p USING (product_id)"
    )).mappings().all()
    return [dict(r) for r in rows]


@router.get("/runs/latest-per-strategy")
def runs_latest_per_strategy(db: Session = Depends(get_db)):
    """Subquery — latest run per strategy."""
    rows = db.execute(text(
        "SELECT id, strategy, buyers, sold, oversold, p99_ms, started_at "
        "FROM m4_concurrency.run_log "
        "WHERE id IN (SELECT MAX(id) FROM m4_concurrency.run_log GROUP BY strategy) "
        "ORDER BY strategy"
    )).mappings().all()
    return [dict(r) for r in rows]


@router.get("/runs/aggregate")
def runs_aggregate(db: Session = Depends(get_db)):
    """Aggregate — average p99 + average oversold per strategy."""
    rows = db.execute(text(
        "SELECT strategy, COUNT(*) AS runs, ROUND(AVG(p99_ms)) AS avg_p99_ms, "
        "ROUND(AVG(oversold), 2) AS avg_oversold "
        "FROM m4_concurrency.run_log GROUP BY strategy ORDER BY strategy"
    )).mappings().all()
    return [dict(r) for r in rows]
