import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.main import create_app
from app.models import User

API_ROOT = Path(__file__).resolve().parents[1]

# Nothing listens on port 1, so connecting fails immediately.
UNREACHABLE_DATABASE_URL = "postgresql+psycopg://nobody:nothing@127.0.0.1:1/unreachable_test"


def get_test_database_url() -> str:
    """Return TEST_DATABASE_URL, refusing anything that is not a *_test database."""
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL is not set. Tests only run against the test database.")
    database = make_url(url).database or ""
    if not database.endswith("_test"):
        pytest.fail(f"Refusing to run tests against '{database}': its name must end in _test.")
    return url


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    """Alembic pointed at the test database instead of DATABASE_URL."""
    config = Config(str(API_ROOT / "alembic.ini"))
    config.attributes["database_url"] = get_test_database_url()
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session")
def test_engine(alembic_config: Config) -> Iterator[Engine]:
    command.upgrade(alembic_config, "head")
    engine = create_engine(get_test_database_url())
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine: Engine) -> Iterator[Session]:
    """A session whose changes are rolled back after each test."""
    with test_engine.connect() as connection:
        transaction = connection.begin()
        with Session(bind=connection) as session:
            yield session
        transaction.rollback()


@pytest.fixture
def unreachable_db_session() -> Iterator[Session]:
    engine = create_engine(UNREACHABLE_DATABASE_URL, connect_args={"connect_timeout": 1})
    with Session(bind=engine) as session:
        yield session
    engine.dispose()


def make_client(session: Session, user: User | None = None) -> TestClient:
    """A client on the test session, acting as user when one is given."""
    app = create_app()

    def override_get_db() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_db] = override_get_db
    if user is not None:
        app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def check_deferred_constraints(db: Session) -> None:
    """Tests never commit, so check deferred foreign keys now instead of at commit."""
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))
