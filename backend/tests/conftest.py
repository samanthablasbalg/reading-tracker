from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import DATABASE_URL, Base, get_db
from app.main import app

engine = create_engine(DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables() -> Generator[None]:
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_data(create_tables: None) -> Generator[None]:
    yield
    with Session(engine) as session:
        for table in reversed(Base.metadata.sorted_tables):
            session.execute(table.delete())
        session.commit()


@pytest.fixture
def client() -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
