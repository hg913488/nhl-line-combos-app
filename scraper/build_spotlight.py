"""Build the Player Spotlight feed: data/spotlight.json.

Run from the repository root as `python scraper/build_spotlight.py`.

What it produces
----------------
One compact row per skater who has played this regular season: season and
last-5 per-game rates, the difference between them, a momentum score, and
current streaks and droughts. The page sorts and filters these rows itself
(heating up, cooling down, streaks, droughts, hot starts), so every filter
sees the whole league rather than a pre-cut top 15.

Also carries recent line promotions and demotions from lineup_changes.json.

Inputs
    api.nhle.com/stats/rest    skater/summary game rows for the current regular
                               season (one limit=-1 request; rows include TOI).
    data/lineup_changes.json   Line/pair/PP moves for `roleChanges`.

Rules and constants
    momentum        (last5 pts/GP - season pts/GP)
                    + 0.25 x (last5 shots/GP - season shots/GP)
                    + 0.10 x (last5 TOI min - season TOI min).
                    Only meaningful once a player has MIN_TREND_GP games, so
                    it is null below that.
    earlySeason     true until any skater reaches MIN_TREND_GP games; the page
                    then shows hot starts instead of heating/cooling lists.
    streaks         consecutive most-recent games with a point (or a goal);
                    droughts are the reverse.

Exits 0 with an empty player list before the season has any completed games.
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from collections import defaultdict
from datetime import date as Date
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper import scrape_goals_against as ga  # noqa: E402

SCHEMA_VERSION = 1
RECENT_GAMES = 5
MIN_TREND_GP = 10
ROLE_WINDOW_DAYS = 7
ROLE_CHANGE_LIMIT = 30
SHOT_WEIGHT = 0.25
TOI_WEIGHT = 0.10

DEFAULT_OUT = Path("data/spotlight.json")
DEFAULT_CHANGES = Path("data/lineup_changes.json")


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    return "".join(ch for ch in text if ch.isalnum() and not unicodedata.combining(ch)).lower()


# ── Per-player maths ──────────────────────────────────────────────────
def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Totals and per-game rates for a list of game rows."""
    gp = len(rows)
    goals = sum(row.get("goals") or 0 for row in rows)
    shots = sum(row.get("shots") or 0 for row in rows)
    points = sum(row.get("points") or 0 for row in rows)
    toi = sum(row.get("timeOnIcePerGame") or 0 for row in rows)
    per = (lambda total: round(total / gp, 2)) if gp else (lambda total: None)
    return {
        "gp": gp,
        "g": goals,
        "a": sum(row.get("assists") or 0 for row in rows),
        "p": points,
        "sog": shots,
        "ppp": sum(row.get("ppPoints") or 0 for row in rows),
        "p_pg": per(points),
        "sog_pg": per(shots),
        "toi": round(toi / gp) if gp else None,
        "sh_pct": round(goals / shots * 100, 1) if shots else None,
    }


def run_length(rows: list[dict[str, Any]], predicate: Callable[[dict[str, Any]], bool]) -> int:
    """How many of the most recent games (rows newest first) satisfy predicate."""
    count = 0
    for row in rows:
        if not predicate(row):
            break
        count += 1
    return count


def momentum_score(season: dict[str, Any], recent: dict[str, Any]) -> float | None:
    if season["gp"] < MIN_TREND_GP or recent["gp"] < RECENT_GAMES:
        return None
    toi_delta_min = ((recent["toi"] or 0) - (season["toi"] or 0)) / 60
    score = ((recent["p_pg"] - season["p_pg"])
             + SHOT_WEIGHT * (recent["sog_pg"] - season["sog_pg"])
             + TOI_WEIGHT * toi_delta_min)
    return round(score, 2)


def player_entry(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """rows: one player's games, newest first."""
    latest = rows[0]
    season = summarize(rows)
    recent = summarize(rows[:RECENT_GAMES])
    # Only what the page renders: this file ships to the browser for ~900 skaters.
    return {
        "id": latest.get("playerId"),
        "name": latest.get("skaterFullName") or "",
        "team": latest.get("teamAbbrev") or "",
        "pos": latest.get("positionCode") or "",
        "season": {key: season[key] for key in ("gp", "g", "a", "p", "sog", "ppp", "p_pg", "sog_pg", "toi", "sh_pct")},
        "last5": {key: recent[key] for key in ("gp", "g", "p", "sog", "p_pg", "sog_pg", "toi")},
        "momentum": momentum_score(season, recent),
        "pointStreak": run_length(rows, lambda row: (row.get("points") or 0) > 0),
        "goalStreak": run_length(rows, lambda row: (row.get("goals") or 0) > 0),
        "pointDrought": run_length(rows, lambda row: not (row.get("points") or 0)),
        "goalDrought": run_length(rows, lambda row: not (row.get("goals") or 0)),
    }


def build_players(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_player: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if isinstance(row.get("playerId"), int):
            by_player[row["playerId"]].append(row)
    players = []
    for games in by_player.values():
        games.sort(key=lambda row: (row.get("gameDate") or "", row.get("gameId") or 0), reverse=True)
        players.append(player_entry(games))
    players.sort(key=lambda player: (-player["season"]["p"], player["name"]))
    return players


# ── Lineup moves ──────────────────────────────────────────────────────
def move_direction(change: dict[str, Any]) -> str | None:
    """'up' or 'down' for a line/pair/PP change; None for additions, removals, trades."""
    if change.get("type") not in ("forward_line", "defense_pair", "power_play"):
        return None
    before, after = change.get("from"), change.get("to")
    if before is None and after is not None:
        return "up"
    if after is None and before is not None:
        return "down"
    if before is None or after is None or before == after:
        return None
    return "up" if after < before else "down"


def role_changes(changes: dict[str, Any] | None, players: list[dict[str, Any]],
                 now: datetime) -> list[dict[str, Any]]:
    cutoff = now - timedelta(days=ROLE_WINDOW_DAYS)
    ids = {normalize_name(player["name"]): player["id"] for player in players}
    seen: set[tuple[str, str]] = set()
    out = []
    for event in (changes or {}).get("events") or []:  # newest first
        if not isinstance(event, dict):
            continue
        try:
            occurred = datetime.fromisoformat(str(event.get("occurred_at", "")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        if occurred < cutoff:
            continue
        moves = [change for change in event.get("changes") or [] if move_direction(change)]
        key = (str(event.get("team")), str(event.get("player")))
        if not moves or key in seen:
            continue
        seen.add(key)
        directions = {move_direction(change) for change in moves}
        out.append({
            "player": event.get("player"),
            "id": ids.get(normalize_name(event.get("player"))),
            "team": event.get("team"),
            "occurred_at": event.get("occurred_at"),
            "direction": "up" if directions == {"up"} else "down" if directions == {"down"} else "mixed",
            "changes": moves,
        })
        if len(out) >= ROLE_CHANGE_LIMIT:
            break
    return out


# ── Document ──────────────────────────────────────────────────────────
def build_document(rows: list[dict[str, Any]], changes: dict[str, Any] | None,
                   season_id: int, now: datetime) -> dict[str, Any]:
    players = build_players(rows)
    max_gp = max((player["season"]["gp"] for player in players), default=0)
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "season": ga.season_label(season_id),
        "season_id": season_id,
        "earlySeason": max_gp < MIN_TREND_GP,
        "minTrendGames": MIN_TREND_GP,
        "players": players,
        "roleChanges": role_changes(changes, players, now),
    }


def write_compact(path: Path, value: dict[str, Any]) -> None:
    """Atomic write like ga.write_atomic, but minified: the page downloads this file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    temp.replace(path)


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print(f"WARNING: could not read {path}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--changes", type=Path, default=DEFAULT_CHANGES)
    parser.add_argument("--date", type=lambda value: Date.fromisoformat(value),
                        help="Treat this date as today (YYYY-MM-DD)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    today = args.date or now.date()
    season_id = ga.current_season_id(today)
    try:
        with requests.Session() as session:
            print(f"Fetching {ga.season_label(season_id)} skater game rows...")
            # The season opens in October (September this year); start early and let empty windows cost a request.
            season_start = Date(season_id // 10000, 9, 1)
            rows = ga.fetch_rows_by_date(session, ga.SKATER_SUMMARY_URL,
                                         f"seasonId={season_id} and gameTypeId={ga.REGULAR_SEASON}",
                                         season_start, min(today, Date(season_id % 10000, 6, 30)))
        document = build_document(rows, load_json(args.changes), season_id, now)
        write_compact(args.out, document)
    except (requests.RequestException, ValueError, OSError) as error:
        print(f"ERROR: spotlight refresh failed: {error}", file=sys.stderr)
        sys.exit(1)
    print(f"{len(rows)} game rows -> {len(document['players'])} players, "
          f"{len(document['roleChanges'])} role changes, earlySeason={document['earlySeason']}")
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
