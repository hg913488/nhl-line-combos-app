"""Build a bounded, structured feed of NHL lineup role changes."""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
MAX_AGE_DAYS = 90
MAX_EVENTS = 500
ROLE_KEYS = ("forwards", "defense", "goalies", "pp1", "pp2")
CHANGE_ORDER = {
    "team": 0,
    "addition": 1,
    "removal": 2,
    "forward_line": 3,
    "defense_pair": 4,
    "power_play": 5,
}


def _normalise_name(value: Any) -> str:
    return " ".join(str(value or "").upper().split())


def _parse_timestamp(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Snapshot is missing updated_at")
    text = value.strip()
    if text.endswith(" UTC"):
        text = text[:-4] + "+00:00"
    elif text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def _members(groups: Any) -> list[str]:
    if not isinstance(groups, list):
        return []
    names: list[str] = []
    for group in groups:
        values = group if isinstance(group, list) else [group]
        names.extend(name for value in values if (name := _normalise_name(value)))
    return names


def _team_is_populated(team: Any) -> bool:
    if not isinstance(team, dict):
        return False
    return bool(
        _members(team.get("forwards"))
        or _members(team.get("defense"))
        or _members(team.get("goalies"))
    )


def _roles_for_team(team_slug: str, team: dict[str, Any]) -> dict[str, dict[str, Any]]:
    roles: dict[str, dict[str, Any]] = {}

    def role(name: str) -> dict[str, Any]:
        return roles.setdefault(
            name,
            {
                "team": team_slug,
                "rostered": True,
                "forward_line": None,
                "defense_pair": None,
                "goalie_slot": None,
                "power_play": None,
            },
        )

    for key, field in (
        ("forwards", "forward_line"),
        ("defense", "defense_pair"),
        ("goalies", "goalie_slot"),
    ):
        groups = team.get(key, [])
        if not isinstance(groups, list):
            continue
        for index, group in enumerate(groups, start=1):
            values = group if isinstance(group, list) else [group]
            for value in values:
                name = _normalise_name(value)
                if name:
                    role(name)[field] = index

    for unit in (1, 2):
        for name in _members(team.get(f"pp{unit}")):
            player = role(name)
            # Prefer PP1 if malformed source data lists a player on both units.
            if player["power_play"] is None or unit < player["power_play"]:
                player["power_play"] = unit
    return roles


def _snapshot_index(snapshot: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], set[str]]:
    teams = snapshot.get("teams")
    if not isinstance(teams, dict):
        raise ValueError("Snapshot teams must be an object")

    index: dict[str, list[dict[str, Any]]] = {}
    populated: set[str] = set()
    for team_slug, team in teams.items():
        if not isinstance(team_slug, str) or not _team_is_populated(team):
            continue
        populated.add(team_slug)
        for name, role in _roles_for_team(team_slug, team).items():
            index.setdefault(name, []).append(role)
    return index, populated


def _empty_role(team: str | None = None) -> dict[str, Any]:
    return {
        "team": team,
        "rostered": False,
        "forward_line": None,
        "defense_pair": None,
        "goalie_slot": None,
        "power_play": None,
    }


def _direction(change_type: str, old: Any, new: Any) -> str | None:
    if old is None or new is None or old == new:
        return None
    if change_type in {"forward_line", "defense_pair", "power_play"}:
        return "promoted" if new < old else "demoted"
    return None


def _role_changes(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    changes = []
    for change_type, field in (
        ("forward_line", "forward_line"),
        ("defense_pair", "defense_pair"),
        ("power_play", "power_play"),
    ):
        old, new = before[field], after[field]
        if old == new:
            continue
        change = {"type": change_type, "from": old, "to": new}
        direction = _direction(change_type, old, new)
        if direction:
            change["direction"] = direction
        changes.append(change)
    return changes


def _event(
    player: str,
    occurred_at: str,
    before: dict[str, Any],
    after: dict[str, Any],
    changes: list[dict[str, Any]],
) -> dict[str, Any]:
    changes = sorted(changes, key=lambda item: CHANGE_ORDER[item["type"]])
    event_types = [change["type"] for change in changes]
    identity = json.dumps(
        [occurred_at, player, before, after, changes],
        sort_keys=True,
        separators=(",", ":"),
    )
    event_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:20]
    importance = "high" if any(
        kind in {"team", "addition", "removal"} for kind in event_types
    ) else "medium"
    return {
        "id": event_id,
        "occurred_at": occurred_at,
        "player": player,
        "team": after["team"] or before["team"],
        "previous_team": before["team"],
        "event_types": event_types,
        "importance": importance,
        "before": before,
        "after": after,
        "changes": changes,
    }


def generate_events(previous: dict[str, Any], current: dict[str, Any]) -> list[dict[str, Any]]:
    """Return deterministic player events for two lineup snapshots.

    Empty team payloads are treated as failed scrapes and are not compared. Player
    names that occur on multiple teams are also skipped because their identity is
    ambiguous without a stable player ID.
    """
    occurred_at = _format_timestamp(_parse_timestamp(current.get("updated_at")))
    old_index, old_populated = _snapshot_index(previous)
    new_index, new_populated = _snapshot_index(current)
    events = []

    for player in sorted(set(old_index) | set(new_index)):
        old_roles = old_index.get(player, [])
        new_roles = new_index.get(player, [])
        if len(old_roles) > 1 or len(new_roles) > 1:
            continue
        before = old_roles[0] if old_roles else None
        after = new_roles[0] if new_roles else None

        if before and after:
            if before["team"] == after["team"]:
                if before["team"] not in old_populated & new_populated:
                    continue
                changes = _role_changes(before, after)
            else:
                comparable = {before["team"], after["team"]}
                if not comparable <= old_populated & new_populated:
                    continue
                changes = [{"type": "team", "from": before["team"], "to": after["team"]}]
                changes.extend(_role_changes(before, after))
        elif after:
            if after["team"] not in old_populated:
                continue
            before = _empty_role(after["team"])
            changes = [{"type": "addition", "from": False, "to": True}]
        elif before:
            if before["team"] not in new_populated:
                continue
            after = _empty_role(before["team"])
            changes = [{"type": "removal", "from": True, "to": False}]
        else:  # pragma: no cover - impossible due to the union above
            continue

        if changes:
            events.append(_event(player, occurred_at, before, after, changes))
    return events


def merge_history(
    existing: dict[str, Any] | None,
    new_events: list[dict[str, Any]],
    generated_at: str,
    max_age_days: int = MAX_AGE_DAYS,
    max_events: int = MAX_EVENTS,
) -> dict[str, Any]:
    generated = _parse_timestamp(generated_at)
    cutoff = generated - timedelta(days=max_age_days)
    by_id: dict[str, dict[str, Any]] = {}
    if isinstance(existing, dict) and isinstance(existing.get("events"), list):
        for event in existing["events"]:
            if isinstance(event, dict) and isinstance(event.get("id"), str):
                by_id[event["id"]] = event
    for event in new_events:
        by_id[event["id"]] = event

    retained = []
    for event in by_id.values():
        try:
            if _parse_timestamp(event.get("occurred_at")) >= cutoff:
                retained.append(event)
        except (TypeError, ValueError):
            continue
    retained.sort(key=lambda item: (item["occurred_at"], item["id"]), reverse=True)
    retained = retained[:max_events]
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _format_timestamp(generated),
        "retention": {"max_age_days": max_age_days, "max_events": max_events},
        "events": retained,
    }


def _load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def build_history(previous_path: Path, current_path: Path, history_path: Path) -> dict[str, Any]:
    previous = _load_json(previous_path)
    current = _load_json(current_path)
    try:
        existing = _load_json(history_path)
    except FileNotFoundError:
        existing = None
    events = generate_events(previous, current)
    history = merge_history(existing, events, current["updated_at"])
    history_path.parent.mkdir(parents=True, exist_ok=True)
    history_path.write_text(
        json.dumps(history, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return history


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--previous", required=True, type=Path)
    parser.add_argument("--current", required=True, type=Path)
    parser.add_argument("--history", required=True, type=Path)
    args = parser.parse_args()
    history = build_history(args.previous, args.current, args.history)
    print(f"Saved {len(history['events'])} lineup change events to {args.history}")


if __name__ == "__main__":
    main()
