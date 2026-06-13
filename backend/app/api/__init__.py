from fastapi import APIRouter

from app.api.books import router as books_router
from app.api.engagements import router as engagements_router

router = APIRouter()
router.include_router(books_router)
router.include_router(engagements_router)
