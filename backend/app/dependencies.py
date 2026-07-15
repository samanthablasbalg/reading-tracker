from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User


def get_current_user(db: Session = Depends(get_db)) -> User:
    return db.execute(select(User)).scalar_one()
