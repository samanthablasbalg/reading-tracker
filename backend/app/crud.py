from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.interfaces import ORMOption

from app.database import Base


class CRUDBase[ModelType: Base]:
    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    def get(
        self, db: Session, id: Any, *, options: Sequence[ORMOption] = ()
    ) -> ModelType | None:
        return db.get(self.model, id, options=options)

    def list(
        self, db: Session, *, options: Sequence[ORMOption] = ()
    ) -> list[ModelType]:
        stmt = select(self.model).options(*options)
        return list(db.execute(stmt).scalars().all())

    def create(self, db: Session, obj: ModelType) -> ModelType:
        db.add(obj)
        db.flush()
        return obj

    def update(self, db: Session, obj: ModelType, payload: BaseModel) -> ModelType:
        for field in payload.model_fields_set:
            setattr(obj, field, getattr(payload, field))
        db.flush()
        return obj

    def delete(self, db: Session, obj: ModelType) -> None:
        db.delete(obj)
        db.flush()

    def get_or_create(
        self,
        db: Session,
        *,
        lookup: dict[str, Any],
        defaults: dict[str, Any] | None = None,
    ) -> ModelType:
        stmt = select(self.model).filter_by(**lookup)
        existing = db.execute(stmt).scalar_one_or_none()
        if existing is not None:
            return existing
        obj = self.model(**lookup, **(defaults or {}))
        db.add(obj)
        db.flush()
        return obj
