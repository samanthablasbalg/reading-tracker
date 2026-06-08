from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import LogUnit
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.engagement import Engagement


class ProgressLog(TimestampMixin, Base):
    __tablename__ = "progress_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engagements.id"))
    logged_at: Mapped[datetime.datetime]
    unit: Mapped[LogUnit] = mapped_column(SAEnum(LogUnit, name="log_unit"))
    page_start: Mapped[int | None]
    page_end: Mapped[int | None]
    minute_start: Mapped[int | None]
    minute_end: Mapped[int | None]
    new_ground: Mapped[bool] = mapped_column(default=True)
    journal_entry: Mapped[str | None] = mapped_column(Text)

    engagement: Mapped[Engagement] = relationship(back_populates="progress_logs")
