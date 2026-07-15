from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class BlogPost(TimestampMixin, Base):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    body: Mapped[str | None] = mapped_column(Text)
    published: Mapped[bool] = mapped_column(default=False)
    written_at: Mapped[datetime.datetime | None]

    user: Mapped[User] = relationship(back_populates="blog_posts")
