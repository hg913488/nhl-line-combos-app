"""Log and grade the Picks tab "WATCH" signal to build a public track record.

log:   For each regular-season/playoff game on a date (America/New_York), record the
       same signal PicksView shows: positions C/LW/RW/D ranked by the defending
       team's last-10 goals allowed RELATIVE TO THE LEAGUE, i.e. the index
       teams[def].l10[pos] / league.l10_avg[pos] from goals_against_by_position.json
       (1.00 = league average). Raw goals allowed always favoured C, which simply
       scores most league-wide; the index answers "who is this team soft against?".
       Ranked descending with ties kept in C, LW, RW, D order. Picks are locked once
       logged and are never logged at or after puck drop.
grade: For logged picks whose games are final, a pick hits when the offense team
       had at least one goal by a skater at the watched position.

Goal attribution uses the same source as scrape_goals_against.py: the NHL stats
API skater summary (per-game rows, positionCode C/L/R/D). That source counts
empty-net goals and excludes shootout goals, so grading does the same.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import tempfile
import time
from datetime import date as Date
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable
from zoneinfo import ZoneInfo

import requests


SCHEMA_VERSION = 2
# Version 1 ranked positions by raw last-10 goals allowed. It only ever shipped
# with an empty picks list (no regular-season pick was logged under it), so a
# v1 file is upgraded in place and a v1 file WITH picks is rejected rather than
# silently mixed with index-ranked picks.
UPGRADEABLE_SCHEMA_VERSIONS = (1,)
POSITIONS = ("C", "LW", "RW", "D")
POSITION_LABELS = {"C": "C", "L": "LW", "R": "RW", "D": "D"}
PICK_GAME_TYPES = {2: "regular", 3: "playoff"}
LOGGABLE_GAME_STATES = {"FUT", "PRE"}
FINAL_GAME_STATES = {"FINAL", "OFF"}
VOID_SCHEDULE_STATES = {"PPD", "CNCL"}
RETAINED_SEASONS = 2
MISSING_GAME_VOID_DAYS = 3
UNRECONCILED_GRACE_HOURS = 48
EASTERN = ZoneInfo("America/New_York")

SCHEDULE_URL = "https://api-web.nhle.com/v1/schedule/{date}"
SKATER_SUMMARY_URL = "https://api.nhle.com/stats/rest/en/skater/summary"
REQUEST_TIMEOUT = 20
DELAY_BETWEEN_REQUESTS = 1  # seconds, be respectful to NHL API

DEFAULT_PATH = Path("data/picks_log.json")
DEFAULT_GA_PATH = Path("data/goals_against_by_position.json")

METHOD = {
    "version": 2,
    "signal": "Positions C, LW, RW, D ranked by the defending team's last-10 goals "
              "allowed to each position divided by the league average for that "
              "position (index; 1.00 = league average, higher = softer than the "
              "league). Descending; ties keep C, LW, RW, D order. WATCH is the top "
              "position. A position with no league average is indexed 0.",
    "grading": "Hit when the offense team scored at least one goal by a skater listed "
               "at the watched position (NHL stats API skater summary). Empty-net "
               "goals count; shootout goals do not.",
    "games": "Regular season and playoffs only. Picks are logged before puck drop "
             "and never changed afterwards.",
}

ScheduleFetcher = Callable[[str], list[dict[str, Any]]]
GoalsFetcher = Callable[[int], list[dict[str, Any]]]


# ── Time helpers ──────────────────────────────────────────────────────
def _parse_utc(value: Any) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Missing timestamp")
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _format_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace(
        "+00:00", "Z"
    )


def eastern_today(now: datetime) -> str:
    return now.astimezone(EASTERN).date().isoformat()


# ── Signal (mirrors PicksView in src/App.jsx) ─────────────────────────
def _ga_value(value: Any) -> float:
    """Mirror JS `allowed[position] || 0` for the numeric data we publish."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return value if math.isfinite(value) else 0


def position_index(allowed: Any, league_average: Any) -> float:
    """Goals allowed relative to the league average for that position.

    1.00 is league average. A missing or zero league average (no games played
    yet) yields 0 rather than an undefined or infinite index.
    """
    average = _ga_value(league_average)
    if average <= 0:
        return 0.0
    return round(_ga_value(allowed) / average, 4)


def rank_positions(
    team_l10: dict[str, Any] | None, league_avg: dict[str, Any] | None,
) -> list[tuple[str, float]]:
    """Rank positions by index, descending. sorted() is stable, like JS sort.

    Pure function shared with the UI (see tests/fixtures/picks_index_cases.json).
    """
    team_l10 = team_l10 if isinstance(team_l10, dict) else {}
    league_avg = league_avg if isinstance(league_avg, dict) else {}
    values = [
        (position, position_index(team_l10.get(position), league_avg.get(position)))
        for position in POSITIONS
    ]
    return sorted(values, key=lambda item: -item[1])


def game_sides(game: dict[str, Any]) -> list[dict[str, str]]:
    away, home = game["awayTeam"]["abbrev"], game["homeTeam"]["abbrev"]
    return [
        {"offense": away, "defense": home, "venue": "away"},
        {"offense": home, "defense": away, "venue": "home"},
    ]


def pick_id(game_id: int, offense: str) -> str:
    return f"{game_id}-{offense}"


def build_pick(
    game: dict[str, Any], side: dict[str, str], game_date: str,
    ga_data: dict[str, Any], logged_at: datetime,
) -> dict[str, Any]:
    team = (ga_data.get("teams") or {}).get(side["defense"])
    if not isinstance(team, dict):
        print(f"WARNING: no goals-against data for {side['defense']}; "
              "logging the all-zero ranking the Picks tab shows")
    league_avg = ((ga_data.get("league") or {}).get("l10_avg")) or {}
    l10 = (team or {}).get("l10") or {}
    ranked = rank_positions(l10, league_avg)
    indexes = dict(ranked)
    return {
        "id": pick_id(game["id"], side["offense"]),
        "game_id": game["id"],
        "date": game_date,
        "start_time_utc": game["startTimeUTC"],
        "season": game.get("season"),
        "game_type": PICK_GAME_TYPES[game["gameType"]],
        "offense": side["offense"],
        "defense": side["defense"],
        "venue": side["venue"],
        "watch": ranked[0][0],
        "ranking": [position for position, _ in ranked],
        "index": {position: indexes[position] for position in POSITIONS},
        "ga_l10": {position: _ga_value(l10.get(position)) for position in POSITIONS},
        "league_l10_avg": {position: _ga_value(league_avg.get(position))
                           for position in POSITIONS},
        "ga_snapshot": {
            "last_updated": ga_data.get("lastUpdated"),
            "season": ga_data.get("season"),
            "season_id": ga_data.get("season_id"),
        },
        "logged_at": _format_utc(logged_at),
        "status": "pending",
        "result": None,
    }


# ── Log step ──────────────────────────────────────────────────────────
def _is_loggable(game: dict[str, Any], now: datetime) -> tuple[bool, str]:
    if game.get("gameType") not in PICK_GAME_TYPES:
        return False, f"game type {game.get('gameType')} (not regular season/playoffs)"
    if game.get("gameScheduleState", "OK") != "OK":
        return False, f"schedule state {game.get('gameScheduleState')}"
    if game.get("gameState") not in LOGGABLE_GAME_STATES:
        return False, f"game state {game.get('gameState')}"
    if now >= _parse_utc(game.get("startTimeUTC")):
        return False, "already started"
    return True, ""


def log_picks(
    doc: dict[str, Any], game_date: str, games: list[dict[str, Any]],
    ga_data: dict[str, Any], now: datetime,
) -> tuple[dict[str, Any], int]:
    """Return a new document with picks for eligible games added. Never overwrites."""
    existing_ids = {pick["id"] for pick in doc["picks"]}
    added = []
    for game in games:
        loggable, reason = _is_loggable(game, now)
        label = f"{game.get('id')} {game.get('awayTeam', {}).get('abbrev')}@" \
                f"{game.get('homeTeam', {}).get('abbrev')}"
        if not loggable:
            print(f"  skip {label}: {reason}")
            continue
        new_sides = [side for side in game_sides(game)
                     if pick_id(game["id"], side["offense"]) not in existing_ids]
        added.extend(build_pick(game, side, game_date, ga_data, now) for side in new_sides)
        print(f"  {'logged' if new_sides else 'already logged'} {label}")
    return {**doc, "picks": doc["picks"] + added}, len(added)


# ── Grade step ────────────────────────────────────────────────────────
def goals_by_team_position(rows: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    totals: dict[str, dict[str, int]] = {}
    for row in rows:
        team, position = row.get("teamAbbrev"), POSITION_LABELS.get(row.get("positionCode"))
        goals = row.get("goals") or 0
        if not team or not position or not goals:
            continue
        team_totals = totals.setdefault(team, {p: 0 for p in POSITIONS})
        team_totals[position] += goals
    return totals


def expected_skater_goals(game: dict[str, Any]) -> dict[str, int]:
    """Final score per team minus the shootout-winner goal, which skater stats omit."""
    away, home = game["awayTeam"], game["homeTeam"]
    scores = {away["abbrev"]: away.get("score"), home["abbrev"]: home.get("score")}
    if any(not isinstance(value, int) for value in scores.values()):
        raise ValueError(f"Final game {game.get('id')} is missing a score")
    if (game.get("gameOutcome") or {}).get("lastPeriodType") == "SO":
        winner = max(scores, key=scores.get)
        scores = {**scores, winner: scores[winner] - 1}
    return scores


def _grade_result(pick: dict[str, Any], goals: dict[str, dict[str, int]],
                  reconciled: bool, now: datetime) -> dict[str, Any]:
    by_position = goals.get(pick["offense"], {p: 0 for p in POSITIONS})
    return {
        "hit": by_position[pick["watch"]] > 0,
        "goals_by_position": dict(by_position),
        "score_reconciled": reconciled,
        "graded_at": _format_utc(now),
    }


def _void(pick: dict[str, Any], reason: str, now: datetime) -> dict[str, Any]:
    return {**pick, "status": "void",
            "result": {"void_reason": reason, "graded_at": _format_utc(now)}}


def _grade_game(
    picks: list[dict[str, Any]], game: dict[str, Any] | None, pick_date: str,
    fetch_goals: GoalsFetcher, now: datetime,
) -> list[dict[str, Any]]:
    """Return updated picks for one game; unchanged picks mean 'not ready yet'."""
    if game is None:
        age = now.astimezone(EASTERN).date() - Date.fromisoformat(pick_date)
        if age.days >= MISSING_GAME_VOID_DAYS:
            return [_void(pick, "game not found on scheduled date", now) for pick in picks]
        return picks
    if game.get("gameScheduleState") in VOID_SCHEDULE_STATES:
        return [_void(pick, f"game {game['gameScheduleState']}", now) for pick in picks]
    if game.get("gameState") not in FINAL_GAME_STATES:
        return picks

    goals = goals_by_team_position(fetch_goals(game["id"]))
    expected = expected_skater_goals(game)
    reconciled = all(sum(goals.get(team, {}).values()) == total
                     for team, total in expected.items())
    if not reconciled:
        past_grace = now - _parse_utc(game["startTimeUTC"]) >= timedelta(
            hours=UNRECONCILED_GRACE_HOURS)
        if not past_grace:
            print(f"  defer {game['id']}: skater goals {goals} do not match score "
                  f"{expected} yet")
            return picks
        print(f"WARNING: grading {game['id']} with unreconciled goals "
              "(likely a goalie goal or stats correction)")
    return [{**pick, "status": "graded",
             "result": _grade_result(pick, goals, reconciled, now)} for pick in picks]


def grade_picks(
    doc: dict[str, Any], fetch_schedule: ScheduleFetcher,
    fetch_goals: GoalsFetcher, now: datetime,
) -> tuple[dict[str, Any], int]:
    pending: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for pick in doc["picks"]:
        if pick.get("status") == "pending":
            pending.setdefault((pick["date"], pick["game_id"]), []).append(pick)
    if not pending:
        return doc, 0

    schedules: dict[str, dict[int, dict[str, Any]]] = {}
    updated: dict[str, dict[str, Any]] = {}
    for (pick_date, game_id), picks in sorted(pending.items()):
        if pick_date not in schedules:
            schedules[pick_date] = {game["id"]: game for game in fetch_schedule(pick_date)}
        game = schedules[pick_date].get(game_id)
        for pick in _grade_game(picks, game, pick_date, fetch_goals, now):
            if pick["status"] != "pending":
                updated[pick["id"]] = pick

    picks = [updated.get(pick["id"], pick) for pick in doc["picks"]]
    return {**doc, "picks": picks}, len(updated)


# ── Summary, retention, document ──────────────────────────────────────
def _rate(hits: int, graded: int) -> float | None:
    return round(hits / graded, 4) if graded else None


def _tally(picks: list[dict[str, Any]]) -> dict[str, Any]:
    hits = sum(1 for pick in picks if pick["result"]["hit"])
    return {"graded": len(picks), "hits": hits, "hit_rate": _rate(hits, len(picks))}


def build_summary(picks: list[dict[str, Any]]) -> dict[str, Any]:
    graded = [pick for pick in picks if pick.get("status") == "graded"]
    # Share of positions that scored in each graded game: the hit rate a random
    # position pick would have had, for judging whether the signal adds anything.
    baseline_hits = sum(
        sum(1 for p in POSITIONS if pick["result"]["goals_by_position"][p] > 0)
        for pick in graded
    )
    seasons = sorted({pick.get("season") for pick in graded if pick.get("season")})
    return {
        **_tally(graded),
        "pending": sum(1 for pick in picks if pick.get("status") == "pending"),
        "void": sum(1 for pick in picks if pick.get("status") == "void"),
        "baseline_hit_rate": _rate(baseline_hits, len(graded) * len(POSITIONS)),
        "by_position": {
            position: _tally([pick for pick in graded if pick["watch"] == position])
            for position in POSITIONS
        },
        "by_season": {
            str(season): _tally([pick for pick in graded if pick.get("season") == season])
            for season in seasons
        },
    }


def apply_retention(picks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep the latest RETAINED_SEASONS seasons (season ids like 20252026)."""
    seasons = [pick["season"] for pick in picks if isinstance(pick.get("season"), int)]
    if not seasons:
        return picks
    oldest_kept = max(seasons) - 10001 * (RETAINED_SEASONS - 1)
    return [pick for pick in picks
            if not isinstance(pick.get("season"), int) or pick["season"] >= oldest_kept]


def _sort_key(pick: dict[str, Any]) -> tuple[str, str, int, int]:
    return (pick["date"], pick["start_time_utc"], pick["game_id"],
            0 if pick.get("venue") == "away" else 1)


def finalize(doc: dict[str, Any]) -> dict[str, Any]:
    picks = sorted(apply_retention(doc["picks"]), key=_sort_key)
    return {
        "schema_version": SCHEMA_VERSION,
        "method": METHOD,
        "retention": {"seasons": RETAINED_SEASONS},
        "summary": build_summary(picks),
        "picks": picks,
    }


def empty_document() -> dict[str, Any]:
    return finalize({"picks": []})


# ── IO ────────────────────────────────────────────────────────────────
def load_document(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return empty_document()
    if not isinstance(value, dict) or not isinstance(value.get("picks"), list):
        raise ValueError(f"{path} is not a picks log (missing picks list)")
    version = value.get("schema_version")
    if version != SCHEMA_VERSION:
        if version in UPGRADEABLE_SCHEMA_VERSIONS and not value["picks"]:
            print(f"Upgrading empty {path} from schema_version {version} "
                  f"to {SCHEMA_VERSION}")
            return {**value, "schema_version": SCHEMA_VERSION}
        raise ValueError(f"{path} has unsupported schema_version {version!r}")
    return value


def load_ga_data(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not isinstance(value.get("teams"), dict):
        raise ValueError(f"{path} is missing the teams object")
    league_avg = (value.get("league") or {}).get("l10_avg")
    if not isinstance(league_avg, dict):
        raise ValueError(f"{path} is missing league.l10_avg; refresh it with "
                         "scraper/scrape_goals_against.py before logging picks")
    return value


def write_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            file.write(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_name, path)
    except BaseException:
        Path(temp_name).unlink(missing_ok=True)
        raise


def save_if_changed(path: Path, before: dict[str, Any], after: dict[str, Any]) -> bool:
    final = finalize(after)
    if final == before and path.exists():
        return False
    write_atomic(path, final)
    return True


# ── NHL API ───────────────────────────────────────────────────────────
def fetch_schedule(game_date: str) -> list[dict[str, Any]]:
    response = requests.get(SCHEDULE_URL.format(date=game_date), timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    week = response.json().get("gameWeek")
    if not isinstance(week, list):
        raise ValueError(f"Schedule response for {game_date} has no gameWeek")
    day = next((item for item in week if item.get("date") == game_date), None)
    return day.get("games", []) if day else []


def fetch_game_goals(game_id: int) -> list[dict[str, Any]]:
    time.sleep(DELAY_BETWEEN_REQUESTS)
    params = {
        "isAggregate": "false",
        "isGame": "true",
        "start": 0,
        "limit": 100,
        "factCayenneExp": "goals>=1",
        "cayenneExp": f"gameId={game_id}",
    }
    response = requests.get(SKATER_SUMMARY_URL, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    rows = response.json().get("data")
    if not isinstance(rows, list):
        raise ValueError(f"Skater summary for game {game_id} has no data list")
    return rows


# ── CLI ───────────────────────────────────────────────────────────────
def run(command: str, path: Path, ga_path: Path, game_date: str | None,
        now: datetime) -> None:
    if command in ("log", "all"):
        doc = load_document(path)
        target = game_date or eastern_today(now)
        games = fetch_schedule(target)
        print(f"Logging picks for {target}: {len(games)} scheduled game(s)")
        logged, added = log_picks(doc, target, games, load_ga_data(ga_path), now)
        changed = save_if_changed(path, doc, logged)
        print(f"Logged {added} new pick(s){'' if changed else ' (no file change)'}")

    if command in ("grade", "all"):
        doc = load_document(path)
        graded, count = grade_picks(doc, fetch_schedule, fetch_game_goals, now)
        changed = save_if_changed(path, doc, graded)
        summary = finalize(graded)["summary"]
        print(f"Graded {count} pick(s){'' if changed else ' (no file change)'}; "
              f"record {summary['hits']}/{summary['graded']} "
              f"(hit rate {summary['hit_rate']}, pending {summary['pending']})")


def _valid_date(value: str) -> str:
    return Date.fromisoformat(value).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", default="all", choices=("log", "grade", "all"))
    parser.add_argument("--date", type=_valid_date,
                        help="Game date to log (YYYY-MM-DD); default today in New York")
    parser.add_argument("--path", type=Path, default=DEFAULT_PATH)
    parser.add_argument("--ga-path", type=Path, default=DEFAULT_GA_PATH)
    args = parser.parse_args()
    try:
        run(args.command, args.path, args.ga_path, args.date, datetime.now(timezone.utc))
    except (requests.RequestException, ValueError, OSError) as error:
        print(f"ERROR: picks log {args.command} failed: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
