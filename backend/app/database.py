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
    db = SessionLocal()
    try:
        user_id = db.execute(text("SELECT id FROM users")).scalar_one()
        db.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(user_id)},
        )
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
