from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError


logger = logging.getLogger("card.errors")


def _new_request_id() -> str:
    return uuid.uuid4().hex[:16]


def _error_payload(detail: str | list | dict, request_id: str) -> dict:
    return {"detail": detail, "request_id": request_id}


def install_error_handlers(app: FastAPI) -> None:
    """three handlers we care about:
    - HTTPException: our own raises. Pass through status + detail, attach request_id.
    - RequestValidationError: pydantic 422s. Same treatment.
    - Everything else: log with full traceback, return generic 500 with request_id.

    middleware that stamps every request with an id, makes it
    available on request.state.request_id, and echoes it back as X-Request-ID.
    """

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or _new_request_id()
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        except Exception:
            # call_next shouldn't raise — FastAPI's exception handlers catch
            # everything. But if some middleware blows up upstream of them,
            # we still want a request id in the logs.
            logger.exception("unhandled exception during request", extra={"request_id": request_id})
            raise
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        request_id = getattr(request.state, "request_id", _new_request_id())
        # 5xx HTTPExceptions are our own intentional ones (e.g. 503 no active modes).
        # Log them at warning so they show up but aren't alarming.
        if exc.status_code >= 500:
            logger.warning(
                "deliberate 5xx",
                extra={
                    "request_id": request_id,
                    "path": request.url.path,
                    "status": exc.status_code,
                    "detail": exc.detail,
                },
            )
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.detail, request_id),
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        request_id = getattr(request.state, "request_id", _new_request_id())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_error_payload(exc.errors(), request_id),
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_exception_handler(
        request: Request, exc: IntegrityError
    ) -> JSONResponse:
        """FK violations, unique violations, check constraint violations.
        Almost always means the caller did something disallowed that we
        should have caught at the app layer but didn't. Log loudly so we
        notice and fix; surface a 409 to the client."""
        request_id = getattr(request.state, "request_id", _new_request_id())
        logger.error(
            "db integrity error",
            exc_info=exc,
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=_error_payload("database constraint violation", request_id),
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(
        request: Request, exc: SQLAlchemyError
    ) -> JSONResponse:
        """Catch-all for non-Integrity DB errors. asyncpg DataError (bad UUID
        format, etc.) lands here. Generic 500, the client shouldn't be
        guessing at the cause."""
        request_id = getattr(request.state, "request_id", _new_request_id())
        logger.error(
            "db error",
            exc_info=exc,
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload("internal error", request_id),
            headers={"X-Request-ID": request_id},
        )

    @app.exception_handler(Exception)
    async def fallback_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Last-resort catch. Anything that escaped the more specific handlers
        ends up here. Log with full traceback; surface only the request_id."""
        request_id = getattr(request.state, "request_id", _new_request_id())
        logger.error(
            "unhandled exception",
            exc_info=exc,
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_payload("internal error", request_id),
            headers={"X-Request-ID": request_id},
        )