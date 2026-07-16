import os

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.api import router

app = FastAPI(title="Reading Tracker")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-insecure-session-secret"),
)
app.include_router(router)
