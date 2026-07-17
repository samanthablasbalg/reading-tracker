from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.api.auth import E2E_TEST_USER_EMAIL
from app.main import app
from app.models.user import User
from app.oauth import oauth

ALLOWED_EMAIL = "friend@example.com"


@pytest.fixture(autouse=True)
def _allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALLOWED_EMAILS", f"{ALLOWED_EMAIL}, another@example.com")


def _mock_google_login(
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    *,
    verified: bool = True,
    picture: str | None = None,
) -> None:
    async def fake_authorize_access_token(request: Request) -> dict[str, Any]:
        return {
            "userinfo": {
                "email": email,
                "email_verified": verified,
                "picture": picture,
            }
        }

    monkeypatch.setattr(
        oauth.google, "authorize_access_token", fake_authorize_access_token
    )


def test_callback_logs_in_allowlisted_user(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google_login(monkeypatch, ALLOWED_EMAIL)

    response = client.get("/api/auth/callback", follow_redirects=False)
    assert response.status_code == 307

    user = db.execute(select(User).where(User.email == ALLOWED_EMAIL)).scalar_one()

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json() == {"id": str(user.id), "email": ALLOWED_EMAIL, "picture": None}


def test_callback_stores_the_google_profile_picture(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    picture_url = "https://lh3.googleusercontent.com/a/example-photo"
    _mock_google_login(monkeypatch, ALLOWED_EMAIL, picture=picture_url)

    client.get("/api/auth/callback", follow_redirects=False)

    me = client.get("/api/auth/me")
    assert me.json()["picture"] == picture_url


def test_callback_rejects_email_not_on_allowlist(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google_login(monkeypatch, "stranger@example.com")

    response = client.get("/api/auth/callback", follow_redirects=False)
    assert response.status_code == 403

    assert (
        db.execute(
            select(User).where(User.email == "stranger@example.com")
        ).scalar_one_or_none()
        is None
    )


def test_callback_rejects_unverified_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google_login(monkeypatch, ALLOWED_EMAIL, verified=False)

    response = client.get("/api/auth/callback", follow_redirects=False)
    assert response.status_code == 400


def test_me_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_business_endpoint_rejects_a_request_with_no_session() -> None:
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get("/api/books")
    assert response.status_code == 401


def test_logout_clears_the_session(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google_login(monkeypatch, ALLOWED_EMAIL)
    client.get("/api/auth/callback", follow_redirects=False)
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_test_login_is_absent_without_the_e2e_flag(client: TestClient) -> None:
    assert client.post("/api/auth/test-login").status_code == 404


def test_test_login_starts_a_session_when_e2e_flagged(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("E2E_TEST_AUTH", "true")

    response = client.post("/api/auth/test-login")
    assert response.status_code == 200

    user = db.execute(
        select(User).where(User.email == E2E_TEST_USER_EMAIL)
    ).scalar_one()

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json() == {
        "id": str(user.id),
        "email": E2E_TEST_USER_EMAIL,
        "picture": None,
    }


def test_test_login_reuses_the_same_user_on_repeat_calls(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("E2E_TEST_AUTH", "true")

    client.post("/api/auth/test-login")
    first_id = client.get("/api/auth/me").json()["id"]

    client.post("/api/auth/test-login")
    second_id = client.get("/api/auth/me").json()["id"]

    assert first_id == second_id
    users = (
        db.execute(select(User).where(User.email == E2E_TEST_USER_EMAIL))
        .scalars()
        .all()
    )
    assert len(users) == 1
