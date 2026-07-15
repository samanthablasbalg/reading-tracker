from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User


def test_duplicate_email_rejected(db: Session) -> None:
    db.add(User(email="reader@example.com"))
    db.commit()

    db.add(User(email="reader@example.com"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
