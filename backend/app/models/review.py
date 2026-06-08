from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.engagement import Engagement


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id"), unique=True
    )
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    body: Mapped[str | None] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=False)
    written_at: Mapped[datetime.datetime | None]

    engagement: Mapped[Engagement] = relationship(back_populates="review")
