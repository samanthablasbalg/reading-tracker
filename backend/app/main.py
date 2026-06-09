from fastapi import FastAPI

from app.api import router

app = FastAPI(title="Reading Tracker")
app.include_router(router)
