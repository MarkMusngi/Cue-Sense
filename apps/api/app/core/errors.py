"""One error response shape for the whole API (docs/architecture.md section 4.6).

Services raise AppError subclasses; the handlers below turn them, request validation
errors and unknown routes into {"error": {"code", "message", "details"}}.
"""

import logging
from collections.abc import Sequence

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    """One problem inside a request. path points into the request body, or starts with
    "query" or "path" for query and path parameters."""

    code: str
    message: str
    path: list[str | int]


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail]


class ErrorResponse(BaseModel):
    error: ErrorBody


class AppError(Exception):
    status_code = 500

    def __init__(self, code: str, message: str, details: Sequence[ErrorDetail] = ()) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = list(details)


class NotFoundError(AppError):
    """Missing, or owned by another user: both are 404 so ids never leak."""

    status_code = 404

    def __init__(self, resource: str) -> None:
        super().__init__("not_found", f"{resource} not found.")


class ConflictError(AppError):
    status_code = 409


class ValidationFailedError(AppError):
    status_code = 422

    def __init__(self, message: str, details: Sequence[ErrorDetail]) -> None:
        super().__init__("validation_failed", message, details)


class ServiceUnavailableError(AppError):
    status_code = 503


_HTTP_ERROR_CODES = {404: "not_found", 405: "method_not_allowed"}


def _error_response(
    status_code: int, code: str, message: str, details: Sequence[ErrorDetail] = ()
) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message, details=list(details)))
    return JSONResponse(status_code=status_code, content=body.model_dump(mode="json"))


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for error in exc.errors():
            path = list(error["loc"])
            # Body errors are relative to the body, like the service-level details.
            if path and path[0] == "body":
                path = path[1:]
            details.append(ErrorDetail(code="schema_invalid", message=error["msg"], path=path))
        return _error_response(422, "validation_failed", "The request is invalid.", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_ERROR_CODES.get(exc.status_code, "http_error")
        return _error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        # Log the real cause; the client gets the error shape without internals.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error_response(500, "internal_error", "Something went wrong.")
