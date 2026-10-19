"""The UnderCover backend."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend import claims, records
from backend.db import db_path
from backend.seed import seed


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Build the database from data/ on the first start."""
    if not db_path().exists():
        seed(db_path())
    yield


app = FastAPI(title="UnderCover", lifespan=lifespan)
app.include_router(claims.router)
app.include_router(records.router)


@app.get("/api/health", operation_id="health")
def health() -> dict[str, str]:
    """Check that the backend is running."""
    return {"status": "ok"}
