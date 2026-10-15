from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine

from app.models import Base


def test_migrations_downgrade_and_upgrade_cleanly(alembic_config: Config) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")


def test_models_match_the_migrations(test_engine: Engine) -> None:
    with test_engine.connect() as connection:
        differences = compare_metadata(
            MigrationContext.configure(connection, opts={"compare_server_default": True}),
            Base.metadata,
        )

    assert differences == []
