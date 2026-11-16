import re
import sqlite3
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.db import get_db
from app.repositories import progress as repo
from app.routers.materials import Owner

router = APIRouter(tags=["progress"])

_LESSON_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

Db = Annotated[sqlite3.Connection, Depends(get_db)]


class StatusBody(BaseModel):
    status: Literal["not_started", "in_progress", "done"]


@router.get("/progress", response_model=dict[str, str])
def get_progress(conn: Db, owner: Owner):
    return repo.get_all(conn, owner)


@router.put("/progress/{lesson_id}", response_model=StatusBody)
def put_progress(lesson_id: str, body: StatusBody, conn: Db, owner: Owner):
    if not _LESSON_ID.match(lesson_id):
        raise HTTPException(status_code=422, detail="invalid lesson id")
    return StatusBody(status=repo.set_status(conn, owner, lesson_id, body.status))
