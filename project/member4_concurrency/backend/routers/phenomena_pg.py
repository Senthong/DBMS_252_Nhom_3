"""HTTP layer for the Postgres phenomena lab. Thin wrapper over RunRegistry."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from phenomena import list_phenomena
from workers import registry

router = APIRouter()


class StartReq(BaseModel):
    phenomenon: str
    isolation: str = "read_committed"
    lock_mode: str = "none"


@router.get("/phenomena")
def phenomena():
    return {"phenomena": list_phenomena()}


@router.post("/start")
def start(req: StartReq):
    try:
        run_id = registry.start(
            phenomenon=req.phenomenon,
            isolation=req.isolation,
            lock_mode=req.lock_mode,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"run_id": run_id, "step_count": registry.step_count(run_id), **registry.state(run_id)}


@router.post("/{run_id}/step/{step_idx}")
def step(run_id: str, step_idx: int):
    try:
        return registry.run_step(run_id, step_idx)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{run_id}/state")
def state(run_id: str):
    try:
        return registry.state(run_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{run_id}/abort")
def abort(run_id: str):
    registry.abort(run_id)
    return {"status": "aborted"}
