from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db, get_unscoped_db
from app.main import app
from app.models.user import User

load_dotenv()

SEED_USER_EMAIL = "test-user@example.com"

_test_database_url = os.getenv("TEST_DATABASE_URL")
if not _test_database_url:
    raise ValueError("TEST_DATABASE_URL environment variable is not set")
TEST_DATABASE_URL: str = _test_database_url

_app_test_database_url = os.getenv("APP_TEST_DATABASE_URL")
if not _app_test_database_url:
    raise ValueError("APP_TEST_DATABASE_URL environment variable is not set")
APP_TEST_DATABASE_URL: str = _app_test_database_url

owner_engine = create_engine(TEST_DATABASE_URL)
app_engine = create_engine(APP_TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=app_engine)

BACKEND_DIR = Path(__file__).resolve().parent.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


def _reset_schema() -> None:
    with owner_engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    Base.metadata.drop_all(owner_engine)


def _truncate_all() -> None:
    table_names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    with owner_engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))


@pytest.fixture(scope="session", autouse=True)
def create_tables() -> Generator[None]:
    os.environ["DATABASE_URL"] = TEST_DATABASE_URL
    _reset_schema()
    command.upgrade(Config(str(ALEMBIC_INI)), "head")
    _truncate_all()
    yield
    _reset_schema()


@pytest.fixture(autouse=True)
def clean_data(create_tables: None) -> Generator[None]:
    yield
    _truncate_all()


@pytest.fixture(autouse=True)
def seed_user(clean_data: None) -> Generator[User]:
    session = Session(owner_engine)
    user = User(email=SEED_USER_EMAIL)
    session.add(user)
    session.commit()
    session.refresh(user)
    session.expunge(user)
    session.close()
    yield user


@pytest.fixture
def db(seed_user: User) -> Generator[Session]:
    connection = app_engine.connect()
    connection.execute(
        text("SELECT set_config('app.current_user_id', :uid, false)"),
        {"uid": str(seed_user.id)},
    )
    connection.commit()
    session = Session(bind=connection)
    try:
        yield session
    finally:
        session.close()
        connection.close()


@pytest.fixture
def owner_db(seed_user: User) -> Generator[Session]:
    session = Session(owner_engine)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app_session(
    seed_user: User,
) -> Generator[Callable[[uuid.UUID], Session]]:
    opened: list[tuple[Session, Connection]] = []

    def _make(user_id: uuid.UUID) -> Session:
        connection = app_engine.connect()
        connection.execute(
            text("SELECT set_config('app.current_user_id', :uid, false)"),
            {"uid": str(user_id)},
        )
        connection.commit()
        session = Session(bind=connection)
        opened.append((session, connection))
        return session

    yield _make
    for session, connection in opened:
        session.close()
        connection.close()


@pytest.fixture
def client(seed_user: User) -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        connection = app_engine.connect()
        try:
            user_id = connection.execute(text("SELECT id FROM users")).scalar_one()
            connection.execute(
                text("SELECT set_config('app.current_user_id', :uid, false)"),
                {"uid": str(user_id)},
            )
            connection.commit()
            session = Session(bind=connection)
            try:
                yield session
            finally:
                session.close()
        finally:
            connection.close()

    def override_get_unscoped_db() -> Generator[Session]:
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_unscoped_db] = override_get_unscoped_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
