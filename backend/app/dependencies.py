from __future__ import annotations

import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_current_user_id, get_db
from app.models.user import User


def get_current_user(
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> User:
    return db.execute(select(User).where(User.id == user_id)).scalar_one()
