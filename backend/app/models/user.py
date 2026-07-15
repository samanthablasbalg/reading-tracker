from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.blog_post import BlogPost
    from app.models.engagement import Engagement
    from app.models.standalone_entry import StandaloneEntry


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(unique=True)

    engagements: Mapped[list[Engagement]] = relationship(back_populates="user")
    standalone_entries: Mapped[list[StandaloneEntry]] = relationship(
        back_populates="user"
    )
    blog_posts: Mapped[list[BlogPost]] = relationship(back_populates="user")
