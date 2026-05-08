"""Demo admin endpoints — seed/reset the m4_concurrency tables."""
from fastapi import APIRouter

import migrate

router = APIRouter()


@router.post("/seed")
def seed():
    migrate.run()
    return {"status": "seeded"}


@router.post("/reset")
def reset():
    migrate.reset_run_log_and_stock()
    return {"status": "reset"}
