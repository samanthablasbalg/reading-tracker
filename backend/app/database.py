import os
import uuid
from collections.abc import Generator

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, status
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


def get_current_user_id(request: Request) -> uuid.UUID:
    raw_user_id = request.session.get("user_id")
    if raw_user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return uuid.UUID(raw_user_id)


def get_db(user_id: uuid.UUID = Depends(get_current_user_id)) -> Generator[Session]:
    connection = engine.connect()
    try:
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


def get_unscoped_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
