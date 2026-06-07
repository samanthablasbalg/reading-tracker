import enum


class BookAuthorRole(enum.StrEnum):
    author = "author"
    illustrator = "illustrator"
    narrator = "narrator"
    colorist = "colorist"
    letterer = "letterer"
    inker = "inker"
    editor = "editor"


class ReadingFormat(enum.StrEnum):
    print = "print"
    digital = "digital"
    audio = "audio"
    combo = "combo"


class ReadingStatus(enum.StrEnum):
    interested = "interested"
    tbr = "tbr"
    reading = "reading"
    finished = "finished"
    paused = "paused"
    dnf = "dnf"
