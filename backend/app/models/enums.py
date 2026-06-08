import enum


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


class ReadingFormat(enum.StrEnum):
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
