import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.api import router

_session_secret = os.getenv("SESSION_SECRET")
if not _session_secret:
    raise ValueError("SESSION_SECRET environment variable is not set")
SESSION_SECRET: str = _session_secret

app = FastAPI(title="Reading Tracker")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
)
app.include_router(router, prefix="/api")
