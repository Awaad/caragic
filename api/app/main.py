import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .core.errors import install_error_handlers

from redis.asyncio import Redis
from .core.rate_limit import set_redis_client

from .api import auth as auth_routes
from .api import visitor as visitor_routes
from .api import admin as admin_routes
from .api import content as content_routes
from .api import submission as submission_routes
from .api import verify as verify_routes



# Structured-ish logging. Includes the request_id in every record's extra dict.
# Production can swap this for python-json-logger or similar; the field names
# are already shaped right.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s [req=%(request_id)s] %(message)s",
    stream=sys.stdout,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: bring up Redis for rate limiting
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    # Ping so we fail fast if Redis is down rather than at the first rate check
    await redis.ping()
    set_redis_client(redis)

    yield

    # Shutdown: close the Redis pool cleanly
    await redis.aclose()

class _RequestIdFilter(logging.Filter):
    """Ensures the request_id field always exists on log records, so the
    format string above doesn't blow up on logs that don't pass one."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


logging.getLogger().addFilter(_RequestIdFilter())

settings = get_settings()



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
    expose_headers=["X-Request-ID"], 
)

install_error_handlers(app)

app.include_router(auth_routes.router, prefix="/api")
app.include_router(admin_routes.router, prefix="/api")
app.include_router(content_routes.router, prefix="/api")
app.include_router(submission_routes.router, prefix="/api")
app.include_router(verify_routes.router, prefix="/api")
app.include_router(visitor_routes.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}