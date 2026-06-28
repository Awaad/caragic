from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings

from .api import auth as auth_routes
from .api import visitor as visitor_routes

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: any pre-flight checks
    yield
    # Shutdown: cleanup


app = FastAPI(
    title="card api",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router, prefix="/api")
app.include_router(visitor_routes.router, prefix="/api")

@app.get("/api/health")
async def health():
    return {"status": "ok"}