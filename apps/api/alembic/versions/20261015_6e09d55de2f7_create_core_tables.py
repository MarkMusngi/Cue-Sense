"""create core tables

Revision ID: 6e09d55de2f7
Revises:
Create Date: 2026-10-15 05:19:50.352110

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6e09d55de2f7"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_table(
        "drills",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.SmallInteger(), nullable=False),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("current_drill_version_id", sa.Uuid(), nullable=True),
        sa.Column("source_drill_version_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'archived')", name=op.f("ck_drills_status_values")
        ),
        sa.CheckConstraint("difficulty BETWEEN 1 AND 5", name=op.f("ck_drills_difficulty_range")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_drills_owner_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_drills")),
        sa.UniqueConstraint("owner_id", "id", name=op.f("uq_drills_owner_id_id")),
        sa.UniqueConstraint("owner_id", "slug", name=op.f("uq_drills_owner_id_slug")),
    )
    op.create_index("ix_drills_owner_id_status", "drills", ["owner_id", "status"], unique=False)
    op.create_table(
        "practice_sessions",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name=op.f("ck_practice_sessions_ended_after_started"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_practice_sessions_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_practice_sessions")),
        sa.UniqueConstraint("owner_id", "id", name=op.f("uq_practice_sessions_owner_id_id")),
    )
    op.create_index(
        "ix_practice_sessions_owner_id_started_at",
        "practice_sessions",
        ["owner_id", "started_at"],
        unique=False,
    )
    op.create_index(
        "ix_practice_sessions_owner_id_open_unique",
        "practice_sessions",
        ["owner_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "tags",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("category IN ('skill', 'custom')", name=op.f("ck_tags_category_values")),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name=op.f("fk_tags_owner_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("owner_id", "id", name=op.f("uq_tags_owner_id_id")),
    )
    op.create_index(
        "ix_tags_owner_id_name_lower_unique",
        "tags",
        ["owner_id", sa.text("lower(name)")],
        unique=True,
    )
    op.create_table(
        "drill_tags",
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("drill_id", sa.Uuid(), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id", "drill_id"],
            ["drills.owner_id", "drills.id"],
            name=op.f("fk_drill_tags_owner_id_drill_id_drills"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id", "tag_id"],
            ["tags.owner_id", "tags.id"],
            name=op.f("fk_drill_tags_owner_id_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_drill_tags_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("drill_id", "tag_id", name=op.f("pk_drill_tags")),
    )
    op.create_index(
        "ix_drill_tags_owner_id_tag_id", "drill_tags", ["owner_id", "tag_id"], unique=False
    )
    op.create_table(
        "drill_versions",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("drill_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=False),
        sa.Column("layout", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("scoring", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "version_number >= 1", name=op.f("ck_drill_versions_version_number_positive")
        ),
        sa.ForeignKeyConstraint(
            ["owner_id", "drill_id"],
            ["drills.owner_id", "drills.id"],
            name=op.f("fk_drill_versions_owner_id_drill_id_drills"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_drill_versions_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_drill_versions")),
        sa.UniqueConstraint("drill_id", "id", name=op.f("uq_drill_versions_drill_id_id")),
        sa.UniqueConstraint(
            "drill_id", "version_number", name=op.f("uq_drill_versions_drill_id_version_number")
        ),
        sa.UniqueConstraint("owner_id", "id", name=op.f("uq_drill_versions_owner_id_id")),
    )
    op.create_table(
        "drill_runs",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("practice_session_id", sa.Uuid(), nullable=False),
        sa.Column("drill_id", sa.Uuid(), nullable=False),
        sa.Column("drill_version_id", sa.Uuid(), nullable=False),
        sa.Column("run_number", sa.Integer(), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at",
            name=op.f("ck_drill_runs_ended_after_started"),
        ),
        sa.CheckConstraint("run_number >= 1", name=op.f("ck_drill_runs_run_number_positive")),
        sa.ForeignKeyConstraint(
            ["drill_id", "drill_version_id"],
            ["drill_versions.drill_id", "drill_versions.id"],
            name=op.f("fk_drill_runs_drill_id_drill_version_id_drill_versions"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id", "drill_id"],
            ["drills.owner_id", "drills.id"],
            name=op.f("fk_drill_runs_owner_id_drill_id_drills"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id", "practice_session_id"],
            ["practice_sessions.owner_id", "practice_sessions.id"],
            name=op.f("fk_drill_runs_owner_id_practice_session_id_practice_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_drill_runs_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_drill_runs")),
        sa.UniqueConstraint("owner_id", "id", name=op.f("uq_drill_runs_owner_id_id")),
        sa.UniqueConstraint(
            "practice_session_id",
            "run_number",
            name=op.f("uq_drill_runs_practice_session_id_run_number"),
        ),
    )
    op.create_index(
        "ix_drill_runs_owner_id_started_at", "drill_runs", ["owner_id", "started_at"], unique=False
    )
    op.create_index(
        "ix_drill_runs_drill_id_started_at", "drill_runs", ["drill_id", "started_at"], unique=False
    )
    op.create_index(
        "ix_drill_runs_drill_version_id", "drill_runs", ["drill_version_id"], unique=False
    )
    op.create_index(
        "ix_drill_runs_practice_session_id", "drill_runs", ["practice_session_id"], unique=False
    )
    op.create_table(
        "attempts",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("drill_run_id", sa.Uuid(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("tapped_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "outcome IN ('success', 'fail', 'partial')", name=op.f("ck_attempts_outcome_values")
        ),
        sa.CheckConstraint("attempt_number >= 1", name=op.f("ck_attempts_attempt_number_positive")),
        sa.CheckConstraint("duration_ms >= 0", name=op.f("ck_attempts_duration_ms_non_negative")),
        sa.CheckConstraint("points >= 0", name=op.f("ck_attempts_points_non_negative")),
        sa.CheckConstraint(
            "voided_at IS NULL OR voided_at >= recorded_at",
            name=op.f("ck_attempts_voided_after_recorded"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id", "drill_run_id"],
            ["drill_runs.owner_id", "drill_runs.id"],
            name=op.f("fk_attempts_owner_id_drill_run_id_drill_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_attempts_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_attempts")),
        sa.UniqueConstraint(
            "drill_run_id", "attempt_number", name=op.f("uq_attempts_drill_run_id_attempt_number")
        ),
        sa.UniqueConstraint(
            "owner_id", "idempotency_key", name=op.f("uq_attempts_owner_id_idempotency_key")
        ),
    )
    op.create_index("ix_attempts_drill_run_id", "attempts", ["drill_run_id"], unique=False)
    op.create_index(
        "ix_attempts_owner_id_recorded_at",
        "attempts",
        ["owner_id", "recorded_at"],
        unique=False,
        postgresql_where=sa.text("voided_at IS NULL"),
    )
    # drills and drill_versions reference each other, so these two foreign keys are
    # added once both tables exist.
    op.create_foreign_key(
        op.f("fk_drills_id_current_drill_version_id_drill_versions"),
        "drills",
        "drill_versions",
        ["id", "current_drill_version_id"],
        ["drill_id", "id"],
        deferrable=True,
        initially="DEFERRED",
    )
    op.create_foreign_key(
        op.f("fk_drills_owner_id_source_drill_version_id_drill_versions"),
        "drills",
        "drill_versions",
        ["owner_id", "source_drill_version_id"],
        ["owner_id", "id"],
        # Hard-deleting a draft clears the link on its copies, not their owner_id.
        ondelete="SET NULL (source_drill_version_id)",
    )
    op.create_index(
        "ix_drills_source_drill_version_id",
        "drills",
        ["source_drill_version_id"],
        unique=False,
        postgresql_where=sa.text("source_drill_version_id IS NOT NULL"),
    )

    # Rules the ORM cannot guarantee on its own.
    op.execute(
        """
        CREATE FUNCTION forbid_drill_version_update() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'drill_versions are immutable: insert a new version instead';
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER forbid_drill_versions_update
        BEFORE UPDATE ON drill_versions
        FOR EACH ROW EXECUTE FUNCTION forbid_drill_version_update()
        """
    )
    op.execute(
        """
        CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
        BEGIN
            NEW.updated_at = clock_timestamp();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        """
        CREATE TRIGGER set_drills_updated_at
        BEFORE UPDATE ON drills
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER set_drills_updated_at ON drills")
    op.execute("DROP FUNCTION set_updated_at()")
    op.execute("DROP TRIGGER forbid_drill_versions_update ON drill_versions")
    op.execute("DROP FUNCTION forbid_drill_version_update()")
    # The circular foreign keys go first; dropping a table drops its own indexes.
    op.drop_constraint(
        op.f("fk_drills_owner_id_source_drill_version_id_drill_versions"),
        "drills",
        type_="foreignkey",
    )
    op.drop_constraint(
        op.f("fk_drills_id_current_drill_version_id_drill_versions"),
        "drills",
        type_="foreignkey",
    )
    op.drop_table("attempts")
    op.drop_table("drill_runs")
    op.drop_table("drill_versions")
    op.drop_table("drill_tags")
    op.drop_table("tags")
    op.drop_table("practice_sessions")
    op.drop_table("drills")
    op.drop_table("users")
