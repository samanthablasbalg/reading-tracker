import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

_database_url = os.getenv("APP_DATABASE_URL")
if not _database_url:
    raise ValueError("APP_DATABASE_URL environment variable is not set")
APP_DATABASE_URL: str = _database_url

engine = create_engine(APP_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session]:
    connection = engine.connect()
    try:
        user_id = connection.execute(text("SELECT id FROM users")).scalar_one()
        connection.execute(
            text("SELECT set_config('app.current_user_id', :uid, false)"),
            {"uid": str(user_id)},
        )
        connection.commit()
        db = Session(bind=connection)
        try:
            yield db
        finally:
            db.close()
    finally:
        connection.close()
