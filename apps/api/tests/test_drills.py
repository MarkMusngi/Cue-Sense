import copy
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Drill, DrillRun, DrillVersion, User
from tests.conftest import check_deferred_constraints, make_client
from tests.factories import LAYOUT, SCORING, make_run, make_session, make_tag, make_user


def drill_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Straight-in",
        "description": "Pocket the 1 ball from the spot.",
        "difficulty": 2,
        "instructions": "Pocket the 1 ball.",
        "layout": copy.deepcopy(LAYOUT),
        "scoring": dict(SCORING),
    }
    body.update(overrides)
    return body


def create(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post("/drills", json=drill_body(**overrides))
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


def update_body(drill: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    """A PUT body that changes nothing, then applies overrides."""
    version = drill["current_version"]
    body: dict[str, Any] = {
        "base_drill_version_id": version["id"],
        "title": drill["title"],
        "description": drill["description"],
        "difficulty": drill["difficulty"],
        "tag_ids": [tag["id"] for tag in drill["tags"]],
        "instructions": version["instructions"],
        "layout": copy.deepcopy(version["layout"]),
        "scoring": dict(version["scoring"]),
    }
    body.update(overrides)
    return body


def give_history(db: Session, owner: User, drill_id: str) -> DrillRun:
    drill = db.get(Drill, uuid.UUID(drill_id))
    assert drill is not None
    return make_run(db, owner, make_session(db, owner), drill)


def error_pairs(response: Any) -> list[tuple[str, list[str | int]]]:
    return [(d["code"], d["path"]) for d in response.json()["error"]["details"]]


def version_count(db: Session, drill_id: str) -> int:
    return db.scalar(select(func.count()).where(DrillVersion.drill_id == uuid.UUID(drill_id))) or 0


# Create


def test_create_drill_returns_a_draft_with_version_1(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner, name="Potting")
    layout = copy.deepcopy(LAYOUT)
    layout["cue_ball"]["x"] = 2.00049

    drill = create(make_client(db_session, owner), tag_ids=[str(tag.id)], layout=layout)
    check_deferred_constraints(db_session)

    assert drill["status"] == "draft"
    assert drill["slug"] == "straight-in"
    assert drill["source_drill_version_id"] is None
    assert [t["name"] for t in drill["tags"]] == ["Potting"]
    version = drill["current_version"]
    assert version["version_number"] == 1
    assert version["layout"]["cue_ball"]["x"] == 2.0
    assert version["scoring"] == SCORING


def test_slugs_are_unique_per_owner(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)

    slugs = [create(client)["slug"] for _ in range(3)]
    other = create(make_client(db_session, make_user(db_session)))

    assert slugs == ["straight-in", "straight-in-2", "straight-in-3"]
    assert other["slug"] == "straight-in"


def test_invalid_layout_and_scoring_are_reported_together(db_session: Session) -> None:
    owner = make_user(db_session)
    layout = copy.deepcopy(LAYOUT)
    layout["object_balls"][0]["x"] = 0.05
    scoring = {**SCORING, "pass_threshold": 11}

    response = make_client(db_session, owner).post(
        "/drills", json=drill_body(layout=layout, scoring=scoring)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"
    assert error_pairs(response) == [
        ("ball_out_of_bounds", ["layout", "object_balls", 0]),
        ("pass_threshold_too_high", ["scoring", "pass_threshold"]),
    ]


def test_malformed_layout_is_a_schema_error_under_layout(db_session: Session) -> None:
    owner = make_user(db_session)
    layout = copy.deepcopy(LAYOUT)
    del layout["cue_ball"]

    response = make_client(db_session, owner).post("/drills", json=drill_body(layout=layout))

    assert response.status_code == 422
    assert error_pairs(response) == [("schema_invalid", ["layout", "cue_ball"])]


def test_missing_fields_are_rejected(db_session: Session) -> None:
    owner = make_user(db_session)
    body = drill_body()
    del body["title"]

    response = make_client(db_session, owner).post("/drills", json=body)

    assert response.status_code == 422
    assert "title" in response.json()["error"]["details"][0]["message"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("instructions", "x" * 10_001),
        ("description", "x" * 2_001),
        ("tag_ids", [str(uuid.uuid4()) for _ in range(51)]),
    ],
)
def test_oversized_fields_are_rejected(db_session: Session, field: str, value: Any) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post("/drills", json=drill_body(**{field: value}))

    assert response.status_code == 422
    assert error_pairs(response) == [("schema_invalid", [field])]


def test_out_of_range_difficulty_is_rejected(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).post("/drills", json=drill_body(difficulty=6))

    assert response.status_code == 422
    assert error_pairs(response) == [("schema_invalid", ["difficulty"])]


def test_another_owners_tag_is_rejected(db_session: Session) -> None:
    owner = make_user(db_session)
    foreign = make_tag(db_session, make_user(db_session))

    response = make_client(db_session, owner).post(
        "/drills", json=drill_body(tag_ids=[str(foreign.id)])
    )

    assert response.status_code == 422
    assert error_pairs(response) == [("unknown_tag", ["tag_ids", 0])]


def test_duplicate_request_cannot_also_carry_drill_fields(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    source = create(client)

    response = client.post("/drills", json={"source_drill_id": source["id"], "title": "X"})

    assert response.status_code == 422


# Get


def test_get_drill(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)

    response = client.get(f"/drills/{drill['id']}")

    assert response.status_code == 200
    assert response.json() == drill


def test_another_owners_drill_is_not_found(db_session: Session) -> None:
    drill = create(make_client(db_session, make_user(db_session)))
    client = make_client(db_session, make_user(db_session))

    for response in [
        client.get(f"/drills/{drill['id']}"),
        client.put(f"/drills/{drill['id']}", json=update_body(drill)),
        client.patch(f"/drills/{drill['id']}", json={"status": "active"}),
        client.delete(f"/drills/{drill['id']}"),
        client.get(f"/drills/{drill['id']}/versions"),
        client.post("/drills", json={"source_drill_id": drill["id"]}),
    ]:
        assert response.status_code == 404, response.text
        assert response.json()["error"]["code"] == "not_found"


def test_unknown_drill_is_not_found(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get(f"/drills/{uuid.uuid4()}")

    assert response.status_code == 404


def test_malformed_drill_id_is_a_validation_error(db_session: Session) -> None:
    owner = make_user(db_session)

    response = make_client(db_session, owner).get("/drills/not-a-uuid")

    assert response.status_code == 422
    assert error_pairs(response)[0][1] == ["path", "drill_id"]


# Update


def test_stale_base_version_is_a_conflict(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    client.put(f"/drills/{drill['id']}", json=update_body(drill, instructions="Version 2."))

    response = client.put(f"/drills/{drill['id']}", json=update_body(drill, title="Stale"))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "stale_version"


def test_editing_drill_fields_does_not_create_a_version(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner, name="Cut")
    client = make_client(db_session, owner)
    drill = create(client)

    response = client.put(
        f"/drills/{drill['id']}",
        json=update_body(
            drill, title="Renamed", description=None, difficulty=4, tag_ids=[str(tag.id)]
        ),
    )

    updated = response.json()
    assert response.status_code == 200
    assert (updated["title"], updated["description"], updated["difficulty"]) == (
        "Renamed",
        None,
        4,
    )
    assert [t["name"] for t in updated["tags"]] == ["Cut"]
    assert updated["slug"] == "straight-in"
    assert updated["current_version"] == drill["current_version"]
    assert version_count(db_session, drill["id"]) == 1


def test_layout_differing_only_by_rounding_or_key_order_is_unchanged(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    layout = dict(reversed(list(copy.deepcopy(drill["current_version"]["layout"]).items())))
    layout["cue_ball"]["x"] = 2.0001
    layout["object_balls"][0]["y"] = 1.2

    response = client.put(f"/drills/{drill['id']}", json=update_body(drill, layout=layout))

    assert response.json()["current_version"]["id"] == drill["current_version"]["id"]
    assert version_count(db_session, drill["id"]) == 1


def _move_ball(drill: dict[str, Any]) -> dict[str, Any]:
    layout = copy.deepcopy(drill["current_version"]["layout"])
    layout["object_balls"][0]["x"] = 6.0
    return {"layout": layout}


def test_changing_instructions_layout_or_scoring_creates_a_version(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    changes: list[dict[str, Any] | None] = [
        {"instructions": "Pocket it twice."},
        {"scoring": {**SCORING, "pass_threshold": 8}},
        None,  # move a ball
    ]

    for expected_number, change in enumerate(changes, start=2):
        body = update_body(drill, **(change if change is not None else _move_ball(drill)))
        response = client.put(f"/drills/{drill['id']}", json=body)
        check_deferred_constraints(db_session)

        assert response.status_code == 200, response.text
        drill = response.json()
        assert drill["current_version"]["version_number"] == expected_number

    assert version_count(db_session, drill["id"]) == 4


def test_existing_drill_runs_keep_their_pinned_version(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    run = give_history(db_session, owner, drill["id"])

    client.put(f"/drills/{drill['id']}", json=update_body(drill, instructions="New."))
    db_session.refresh(run)

    assert str(run.drill_version_id) == drill["current_version"]["id"]


def test_invalid_update_creates_nothing(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    layout = copy.deepcopy(drill["current_version"]["layout"])
    layout["cue_ball"]["x"] = 9.0

    response = client.put(
        f"/drills/{drill['id']}", json=update_body(drill, title="New", layout=layout)
    )

    assert response.status_code == 422
    assert client.get(f"/drills/{drill['id']}").json()["title"] == "Straight-in"
    assert version_count(db_session, drill["id"]) == 1


def test_archived_drills_can_be_edited(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    client.patch(f"/drills/{drill['id']}", json={"status": "archived"})

    response = client.put(f"/drills/{drill['id']}", json=update_body(drill, title="Still mine"))

    assert response.status_code == 200
    assert response.json()["status"] == "archived"


# Status


def test_allowed_status_changes(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)

    statuses = []
    for status in ["active", "active", "archived", "active", "archived"]:
        response = client.patch(f"/drills/{drill['id']}", json={"status": status})
        assert response.status_code == 200, response.text
        statuses.append(response.json()["status"])

    assert statuses == ["active", "active", "archived", "active", "archived"]


def test_draft_can_be_archived_directly(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)

    response = client.patch(f"/drills/{drill['id']}", json={"status": "archived"})

    assert response.json()["status"] == "archived"


def test_going_back_to_draft_is_a_conflict(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    client.patch(f"/drills/{drill['id']}", json={"status": "active"})

    response = client.patch(f"/drills/{drill['id']}", json={"status": "draft"})

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_status_transition"


def test_archiving_a_drill_with_history_keeps_its_history(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    give_history(db_session, owner, drill["id"])
    client.put(f"/drills/{drill['id']}", json=update_body(drill, instructions="Version 2."))

    response = client.patch(f"/drills/{drill['id']}", json={"status": "archived"})

    assert response.status_code == 200
    assert response.json()["status"] == "archived"
    assert version_count(db_session, drill["id"]) == 2
    runs = db_session.scalar(
        select(func.count()).where(DrillRun.drill_id == uuid.UUID(drill["id"]))
    )
    assert runs == 1
    assert client.get(f"/drills/{drill['id']}/versions").json()["total"] == 2


# Delete


def test_deleting_a_draft_without_history_removes_it(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client, tag_ids=[str(make_tag(db_session, owner).id)])
    copy_ = client.post("/drills", json={"source_drill_id": drill["id"]}).json()

    response = client.delete(f"/drills/{drill['id']}")
    check_deferred_constraints(db_session)

    assert response.status_code == 204
    assert client.get(f"/drills/{drill['id']}").status_code == 404
    assert version_count(db_session, drill["id"]) == 0
    assert client.get(f"/drills/{copy_['id']}").json()["source_drill_version_id"] is None


def test_deleting_a_drill_with_history_is_a_conflict(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    give_history(db_session, owner, drill["id"])

    response = client.delete(f"/drills/{drill['id']}")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "drill_not_deletable"


def test_deleting_an_active_drill_is_a_conflict(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    client.patch(f"/drills/{drill['id']}", json={"status": "active"})

    response = client.delete(f"/drills/{drill['id']}")

    assert response.status_code == 409
    assert version_count(db_session, drill["id"]) == 1


# Duplicate


def test_duplicate_copies_the_current_version_and_tags(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner, name="Cut")
    client = make_client(db_session, owner)
    source = create(client, tag_ids=[str(tag.id)])
    client.patch(f"/drills/{source['id']}", json={"status": "active"})
    source = client.put(
        f"/drills/{source['id']}", json=update_body(source, instructions="Version 2.")
    ).json()

    response = client.post("/drills", json={"source_drill_id": source["id"]})
    check_deferred_constraints(db_session)

    assert response.status_code == 201
    duplicate = response.json()
    assert duplicate["id"] != source["id"]
    assert duplicate["title"] == "Straight-in (copy)"
    assert duplicate["slug"] == "straight-in-copy"
    assert duplicate["status"] == "draft"
    assert duplicate["difficulty"] == source["difficulty"]
    assert duplicate["description"] == source["description"]
    assert [t["name"] for t in duplicate["tags"]] == ["Cut"]
    assert duplicate["source_drill_version_id"] == source["current_version"]["id"]
    version = duplicate["current_version"]
    assert version["version_number"] == 1
    assert version["instructions"] == "Version 2."
    assert version["layout"] == source["current_version"]["layout"]
    assert version["scoring"] == source["current_version"]["scoring"]


def test_archived_drills_can_be_duplicated_more_than_once(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    source = create(client)
    client.patch(f"/drills/{source['id']}", json={"status": "archived"})

    slugs = [
        client.post("/drills", json={"source_drill_id": source["id"]}).json()["slug"]
        for _ in range(2)
    ]

    assert slugs == ["straight-in-copy", "straight-in-copy-2"]


# List


def test_list_is_scoped_sorted_and_includes_every_status(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    for title in ["cut shot", "Bank shot", "Stop shot"]:
        create(client, title=title)
    archived = create(client, title="Archived drill")
    client.patch(f"/drills/{archived['id']}", json={"status": "archived"})
    create(make_client(db_session, make_user(db_session)), title="Not mine")

    page = client.get("/drills").json()

    assert [d["title"] for d in page["items"]] == [
        "Archived drill",
        "Bank shot",
        "cut shot",
        "Stop shot",
    ]
    assert page["total"] == 4


def test_list_filters(db_session: Session) -> None:
    owner = make_user(db_session)
    tag = make_tag(db_session, owner)
    client = make_client(db_session, owner)
    create(client, title="Tagged", tag_ids=[str(tag.id)], difficulty=3)
    active = create(client, title="Active", description="Uses a 100% stop shot")
    client.patch(f"/drills/{active['id']}", json={"status": "active"})
    create(client, title="Plain stop drill")

    def titles(**params: Any) -> list[str]:
        return [d["title"] for d in client.get("/drills", params=params).json()["items"]]

    assert titles(tag_id=str(tag.id)) == ["Tagged"]
    assert titles(difficulty=3) == ["Tagged"]
    assert titles(status="active") == ["Active"]
    assert titles(search="STOP") == ["Active", "Plain stop drill"]
    assert titles(search="100%") == ["Active"]
    assert titles(search="_") == []
    assert titles(status="draft", search="stop") == ["Plain stop drill"]


def test_list_is_paginated(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    for title in ["A", "B", "C"]:
        create(client, title=title)

    page = client.get("/drills", params={"limit": 2, "offset": 1}).json()

    assert [d["title"] for d in page["items"]] == ["B", "C"]
    assert (page["total"], page["limit"], page["offset"]) == (3, 2, 1)


# Versions


def test_versions_are_listed_newest_first_and_paginated(db_session: Session) -> None:
    owner = make_user(db_session)
    client = make_client(db_session, owner)
    drill = create(client)
    for n in range(2, 4):
        drill = client.put(
            f"/drills/{drill['id']}", json=update_body(drill, instructions=f"Version {n}.")
        ).json()

    page = client.get(f"/drills/{drill['id']}/versions", params={"limit": 2}).json()

    assert [v["version_number"] for v in page["items"]] == [3, 2]
    assert page["total"] == 3
    assert page["items"][0]["instructions"] == "Version 3."
