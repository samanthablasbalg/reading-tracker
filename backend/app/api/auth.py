from __future__ import annotations

import os
from typing import Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.crud import user_crud
from app.database import get_unscoped_db
from app.models.user import User
from app.oauth import oauth

router = APIRouter(prefix="/auth", tags=["auth"])

E2E_TEST_USER_EMAIL = "test-user@example.com"
DEV_TEST_USER_EMAIL = "blasbalgs@gmail.com"

_TEST_LOGIN_PERSONAS: dict[str, str] = {
    "e2e": E2E_TEST_USER_EMAIL,
    "dev": DEV_TEST_USER_EMAIL,
}


class TestLoginRequest(BaseModel):
    persona: Literal["e2e", "dev"] = "e2e"


def _get_or_create_user(db: Session, email: str) -> User:
    user = user_crud.get_or_create(db, lookup={"email": email})
    db.commit()
    return user


def _allowlist() -> set[str]:
    raw = os.getenv("ALLOWED_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:4200")


@router.get("/login")
async def login(request: Request) -> RedirectResponse:
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or str(request.url_for("callback"))
    response = await oauth.google.authorize_redirect(request, redirect_uri)
    return cast(RedirectResponse, response)


@router.get("/callback")
async def callback(
    request: Request, db: Session = Depends(get_unscoped_db)
) -> RedirectResponse:
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo") or {}
    email = userinfo.get("email")
    if not email or not userinfo.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return a verified email.",
        )
    if email.lower() not in _allowlist():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not on the allowlist.",
        )

    user = _get_or_create_user(db, email)

    request.session["user_id"] = str(user.id)
    request.session["email"] = email
    request.session["picture"] = userinfo.get("picture")
    return RedirectResponse(_frontend_url())


@router.get("/me")
def me(request: Request) -> dict[str, str | None]:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return {
        "id": user_id,
        "email": request.session.get("email"),
        "picture": request.session.get("picture"),
    }


@router.post("/logout")
def logout(request: Request) -> dict[str, bool]:
    request.session.clear()
    return {"ok": True}


@router.post("/test-login")
def test_login(
    request: Request,
    payload: TestLoginRequest = TestLoginRequest(),
    db: Session = Depends(get_unscoped_db),
) -> dict[str, bool]:
    if os.getenv("ALLOW_TEST_LOGIN") != "true":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    email = _TEST_LOGIN_PERSONAS[payload.persona]
    user = _get_or_create_user(db, email)
    request.session["user_id"] = str(user.id)
    request.session["email"] = email
    return {"ok": True}
