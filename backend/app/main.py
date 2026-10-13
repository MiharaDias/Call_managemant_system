from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .common import seed_options
from .config import BASE_DIR, settings
from .db import SessionLocal, migrate
from .routers import auth, calls, dashboard, excel, options, tags, tasks, teachers


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.database_url.startswith("sqlite"):
        (BASE_DIR / "data").mkdir(exist_ok=True)
    migrate()
    with SessionLocal() as db:
        seed_options(db)
    yield


app = FastAPI(title="Agent Flow – Client Call Management", lifespan=lifespan)

api = APIRouter(prefix="/api")
for r in (auth, teachers, calls, tasks, dashboard, options, tags, excel):
    api.include_router(r.router)
app.include_router(api)

# Serve the built React app (production). In development Vite serves it and proxies /api here.
dist: Path = settings.frontend_dist
if (dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        f = (dist / path).resolve()
        if path and f.is_file() and dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(dist / "index.html")
