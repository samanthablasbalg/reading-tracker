from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.crud import edition_crud, engagement_edition_crud
from app.exceptions import ConflictError, NotFoundError
from app.models.edition import EngagementEdition
from app.models.engagement import Engagement
from app.models.enums import Format


def create_binding(
    db: Session,
    engagement: Engagement,
    *,
    edition_id: uuid.UUID | None,
    edition_format: Format | None,
    origin_id: uuid.UUID | None,
    length_override: int | None,
) -> EngagementEdition:
    if edition_id is not None:
        edition = edition_crud.get_or_raise(db, edition_id)
    else:
        candidates = edition_crud.list_by(
            db, book_id=engagement.book_id, edition_format=edition_format
        )
        if len(candidates) == 0:
            raise NotFoundError(
                f"No {edition_format} edition exists for this book; create one first"
            )
        if len(candidates) > 1:
            raise ConflictError(
                "Multiple editions exist for this format; pass edition_id instead"
            )
        edition = candidates[0]

    if engagement_edition_crud.get(db, (engagement.id, edition.id)) is not None:
        raise ConflictError("This edition is already bound to this engagement.")

    return engagement_edition_crud.create(
        db,
        EngagementEdition(
            engagement_id=engagement.id,
            edition_id=edition.id,
            user_id=engagement.user_id,
            origin_id=origin_id,
            length_override=length_override,
        ),
    )
