from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.errors import (
    ConflictError,
    ErrorDetail,
    NotFoundError,
    ValidationFailedError,
    register_error_handlers,
)


class Item(BaseModel):
    name: str
    size: int


def make_error_app() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/missing")
    def missing() -> None:
        raise NotFoundError("Drill")

    @app.get("/conflict")
    def conflict() -> None:
        raise ConflictError("stale_version", "The drill has changed.")

    @app.get("/invalid")
    def invalid() -> None:
        raise ValidationFailedError(
            "The layout is invalid.",
            [
                ErrorDetail(
                    code="balls_overlap", message="Overlap.", path=["layout", "object_balls", 1]
                )
            ],
        )

    @app.post("/items")
    def create_item(item: Item) -> Item:
        return item

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("database password is hunter2")

    return TestClient(app, raise_server_exceptions=False)


def test_not_found_error_uses_the_error_shape() -> None:
    response = make_error_app().get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Drill not found.", "details": []}
    }


def test_conflict_error_uses_the_error_shape() -> None:
    response = make_error_app().get("/conflict")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "stale_version"


def test_validation_failed_error_carries_details() -> None:
    response = make_error_app().get("/invalid")

    assert response.status_code == 422
    assert response.json()["error"] == {
        "code": "validation_failed",
        "message": "The layout is invalid.",
        "details": [
            {"code": "balls_overlap", "message": "Overlap.", "path": ["layout", "object_balls", 1]}
        ],
    }


def test_request_validation_errors_use_the_error_shape_with_body_relative_paths() -> None:
    response = make_error_app().post("/items", json={"name": "x", "size": "big"})

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_failed"
    assert [(d["code"], d["path"]) for d in error["details"]] == [("schema_invalid", ["size"])]


def test_unexpected_errors_use_the_error_shape_without_internals() -> None:
    response = make_error_app().get("/boom")

    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "internal_error", "message": "Something went wrong.", "details": []}
    }


def test_unknown_routes_use_the_error_shape() -> None:
    response = make_error_app().get("/nowhere")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
