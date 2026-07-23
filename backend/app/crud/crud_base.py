from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.interfaces import ORMOption

from app.database import Base
from app.exceptions import NotFoundError


class CRUDBase[ModelType: Base]:
    def __init__(self, model: type[ModelType]) -> None:
        self.model = model

    def get(
        self, db: Session, id: Any, *, options: Sequence[ORMOption] = ()
    ) -> ModelType | None:
        return db.get(self.model, id, options=options)

    def get_or_raise(
        self,
        db: Session,
        id: Any,
        *,
        options: Sequence[ORMOption] = (),
        message: str | None = None,
    ) -> ModelType:
        obj = self.get(db, id, options=options)
        if obj is None:
            raise NotFoundError(message or f"{self.model.__name__} not found")
        return obj

    def get_by(
        self, db: Session, *, options: Sequence[ORMOption] = (), **filters: Any
    ) -> ModelType | None:
        stmt = select(self.model).filter_by(**filters).options(*options)
        return db.execute(stmt).scalar_one_or_none()

    def list_by(
        self, db: Session, *, options: Sequence[ORMOption] = (), **filters: Any
    ) -> list[ModelType]:
        stmt = select(self.model).filter_by(**filters).options(*options)
        return list(db.execute(stmt).scalars().all())

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
        existing = self.get_by(db, **lookup)
        if existing is not None:
            return existing
        obj = self.model(**lookup, **(defaults or {}))
        return self.create(db, obj)
