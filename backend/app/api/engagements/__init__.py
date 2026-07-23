from __future__ import annotations

from fastapi import APIRouter

from . import bindings, lifecycle, progress_logs, reviews

router = APIRouter(tags=["engagements"])
router.include_router(lifecycle.router, prefix="/engagements")
router.include_router(progress_logs.router, prefix="/engagements")
router.include_router(bindings.router, prefix="/engagements")
router.include_router(reviews.router, prefix="/engagements")
