from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class ReviewUpsert(BaseModel):
    rating: Decimal | None = None
    body: str | None = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        if not (Decimal("1.00") <= v <= Decimal("5.00")):
            raise ValueError("Rating must be between 1.00 and 5.00")
        if v % Decimal("0.25") != Decimal("0"):
            raise ValueError("Rating must be in 0.25 increments")
        return v


class ReviewRead(BaseModel):
    rating: Decimal | None
    body: str | None

    model_config = ConfigDict(from_attributes=True)
