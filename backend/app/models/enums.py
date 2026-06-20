import enum

from sqlalchemy import Enum as SAEnum

from app.database import Base


class BookAuthorRole(enum.StrEnum):
    author = "author"
    illustrator = "illustrator"
    narrator = "narrator"
    colorist = "colorist"
    letterer = "letterer"
    inker = "inker"
    editor = "editor"


class DatePrecision(enum.StrEnum):
    day = "day"
    month = "month"
    year = "year"


class LogUnit(enum.StrEnum):
    pages = "pages"
    minutes = "minutes"


class Format(enum.StrEnum):
    print = "print"
    digital = "digital"
    audio = "audio"


class ReadingStatus(enum.StrEnum):
    interested = "interested"
    tbr = "tbr"
    reading = "reading"
    finished = "finished"
    paused = "paused"
    dnf = "dnf"


# Shared Postgres ENUM type. `date_precision` is used by multiple tables (books,
# engagements, standalone_entries), so it is declared once and bound to the
# metadata; that makes SQLAlchemy emit a single CREATE TYPE for it. Per-table
# enums (reading_status, log_unit, etc.) stay inline in their own model files.
date_precision_type = SAEnum(
    DatePrecision, name="date_precision", metadata=Base.metadata
)
