from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.edition import EngagementEdition
from app.schemas import EngagementEditionCreate, EngagementEditionRead
from app.services.engagements import bindings as bindings_service
from app.services.engagements.lifecycle import engagement_crud, engagement_edition_crud

router = APIRouter()

_BINDING_OPTIONS = (selectinload(EngagementEdition.edition),)


@router.post(
    "/{engagement_id}/editions",
    response_model=EngagementEditionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_binding(
    engagement_id: uuid.UUID,
    payload: EngagementEditionCreate,
    db: Session = Depends(get_db),
) -> EngagementEditionRead:
    engagement = engagement_crud.get_or_raise(db, engagement_id)
    binding = bindings_service.create_binding(
        db,
        engagement,
        edition_id=payload.edition_id,
        edition_format=payload.edition_format,
        origin_id=payload.origin_id,
        length_override=payload.length_override,
    )
    db.commit()

    loaded = engagement_edition_crud.get_or_raise(
        db, (engagement_id, binding.edition_id), options=_BINDING_OPTIONS
    )
    return EngagementEditionRead.model_validate(loaded)


@router.get("/{engagement_id}/editions", response_model=list[EngagementEditionRead])
def list_bindings(
    engagement_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[EngagementEditionRead]:
    engagement_crud.get_or_raise(db, engagement_id)
    bindings = engagement_edition_crud.list_by(
        db, options=_BINDING_OPTIONS, engagement_id=engagement_id
    )
    return [EngagementEditionRead.model_validate(b) for b in bindings]


@router.delete(
    "/{engagement_id}/editions/{edition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_binding(
    engagement_id: uuid.UUID,
    edition_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    binding = engagement_edition_crud.get_or_raise(db, (engagement_id, edition_id))
    engagement_edition_crud.delete(db, binding)
    db.commit()
