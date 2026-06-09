from __future__ import annotations

import datetime
import uuid

from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin


class BlogPost(TimestampMixin, Base):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str]
    body: Mapped[str | None] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=False)
    written_at: Mapped[datetime.datetime | None]
