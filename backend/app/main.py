import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.routing import APIRoute
from starlette.middleware.sessions import SessionMiddleware

from app.api import router
from app.exceptions import register_exception_handlers

_session_secret = os.getenv("SESSION_SECRET")
if not _session_secret:
    raise ValueError("SESSION_SECRET environment variable is not set")
SESSION_SECRET: str = _session_secret


def _unique_operation_id(route: APIRoute) -> str:
    tag = route.tags[0] if route.tags else "root"
    return f"{tag}-{route.name}"


app = FastAPI(title="Reading Tracker", generate_unique_id_function=_unique_operation_id)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    https_only=os.getenv("SESSION_COOKIE_SECURE", "").lower() == "true",
)
app.include_router(router, prefix="/api")
register_exception_handlers(app)

FRONTEND_DIST = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend"
    / "dist"
    / "reading-tracker-app"
    / "browser"
)

if FRONTEND_DIST.is_dir():

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404)

        candidate = (FRONTEND_DIST / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(FRONTEND_DIST.resolve()):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
