"""Goals against by scorer position, per team.

Source: the NHL stats API (api.nhle.com/stats/rest/en).
Output: data/goals_against_by_position.json

Rules this scraper follows
--------------------------
Season
    The season is derived from today's date, never hard coded: a season that
    starts in year Y is `Y * 10000 + (Y + 1)` and is considered current from
    July 1 of year Y. `season_id`/`season` in the output name the season the
    ytd/home/away splits come from. When the current season has no completed
    regular-season games yet (July through opening night), those splits fall
    back to the previous season and the label says so.

L10
    The team's last 10 regular-season games ACTUALLY PLAYED, not the last 10
    dates it allowed a goal: a shutout counts as a game with zero goals
    against. Completed games come from the stats API team summary, one row per
    team per game. When the current season has fewer than 10 completed games
    for a team, the window is filled with that team's most recent previous
    season games; `l10_games` and `l10_seasons` record exactly which games
    were used.

League averages
    `league.l10_avg` / `league.ytd_avg` are the mean team value per position
    (sum over the 32 teams / 32). They are the denominator of the Picks index
    in picks_log.py, so they are published with the splits that produced them.

Paging
    api.nhle.com caps `limit` at 100 rows per request but returns every row for
    `limit=-1`. fetch_rows() asks for -1 and only falls back to paging (by the
    number of rows actually returned, under a stable sort) if the response is
    short.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from datetime import date as Date
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests


STATS_BASE = "https://api.nhle.com/stats/rest/en"
SKATER_SUMMARY_URL = f"{STATS_BASE}/skater/summary"
TEAM_SUMMARY_URL = f"{STATS_BASE}/team/summary"

POSITIONS = ("C", "LW", "RW", "D")
POSITION_LABELS = {"C": "C", "L": "LW", "R": "RW", "D": "D"}
REGULAR_SEASON = 2
PLAYOFFS = 3
L10_GAMES = 10
SEASON_START_MONTH = 7  # July: the new season id becomes current

REQUEST_TIMEOUT = 30
DELAY_BETWEEN_REQUESTS = 1  # seconds, be polite to the NHL API
PAGE_FALLBACK_LIMIT = 100  # documented server cap, only used if limit=-1 is short
STABLE_SORT = json.dumps([
    {"property": "gameId", "direction": "ASC"},
    {"property": "playerId", "direction": "ASC"},
])

NHL_TEAMS = (
    "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL",
    "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD",
    "NSH", "NYI", "NYR", "OTT", "PHI", "PIT", "SEA", "SJS",
    "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
)

DEFAULT_PATH = Path("data/goals_against_by_position.json")


# ── Season helpers ────────────────────────────────────────────────────
def current_season_id(today: Date) -> int:
    """Season id for `today`, e.g. 2026-09-19 -> 20262027, 2026-03-14 -> 20252026."""
    start_year = today.year if today.month >= SEASON_START_MONTH else today.year - 1
    return start_year * 10000 + (start_year + 1)


def previous_season_id(season_id: int) -> int:
    return season_id - 10001


def season_label(season_id: int) -> str:
    """20252026 -> '2025-26'."""
    return f"{season_id // 10000}-{str(season_id % 10000)[-2:]}"


# ── Stats API ─────────────────────────────────────────────────────────
def _get(session: requests.Session, url: str, params: dict[str, Any]) -> dict[str, Any]:
    response = session.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ValueError(f"Unexpected stats response from {url}")
    return payload


def fetch_rows(
    session: requests.Session, url: str, cayenne: str,
    fact_cayenne: str | None = None, is_game: bool = True,
) -> list[dict[str, Any]]:
    """Fetch every row for a query.

    `limit=-1` returns the full result set in one request. If the server ever
    truncates it, fall back to paging by the number of rows actually returned
    (never by an assumed page size) under a stable sort.
    """
    params = {
        "isAggregate": "false",
        "isGame": "true" if is_game else "false",
        "start": 0,
        "limit": -1,
        "cayenneExp": cayenne,
    }
    if fact_cayenne:
        params["factCayenneExp"] = fact_cayenne

    payload = _get(session, url, params)
    rows = list(payload["data"])
    total = payload.get("total")
    if not isinstance(total, int) or len(rows) >= total:
        return rows

    print(f"  limit=-1 returned {len(rows)}/{total} rows; paging for the rest")
    rows = []
    start = 0
    while start < total:
        time.sleep(DELAY_BETWEEN_REQUESTS)
        page = _get(session, url, {
            **params, "start": start, "limit": PAGE_FALLBACK_LIMIT, "sort": STABLE_SORT,
        })["data"]
        if not page:
            break
        rows.extend(page)
        start += len(page)
    return rows


def fetch_goal_rows(session: requests.Session, season_id: int) -> list[dict[str, Any]]:
    """Per-game skater rows with at least one goal for a regular season."""
    print(f"Fetching goal rows for {season_label(season_id)}...")
    rows = fetch_rows(
        session, SKATER_SUMMARY_URL,
        cayenne=f"seasonId={season_id} and gameTypeId={REGULAR_SEASON}",
        fact_cayenne="goals>=1",
    )
    print(f"  {len(rows)} goal rows ({sum(row.get('goals') or 0 for row in rows)} goals)")
    return rows


def fetch_team_games(
    session: requests.Session, season_id: int,
    game_types: Iterable[int] = (REGULAR_SEASON,),
) -> dict[str, list[dict[str, Any]]]:
    """Completed games per team abbreviation, oldest first.

    One team summary row exists per team per completed game, so a team's games
    are the rows whose `opponentTeamAbbrev` is that team (that row's homeRoad
    belongs to the opponent, so the team is home when the row says road).
    """
    types = ",".join(str(value) for value in game_types)
    print(f"Fetching completed games for {season_label(season_id)} (types {types})...")
    rows = fetch_rows(
        session, TEAM_SUMMARY_URL,
        cayenne=f"seasonId={season_id} and gameTypeId in ({types})",
    )
    games: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        team, game_id = row.get("opponentTeamAbbrev"), row.get("gameId")
        date, opponent_venue = row.get("gameDate"), row.get("homeRoad")
        if not team or not isinstance(game_id, int) or not date:
            continue
        games.setdefault(team, []).append({
            "game_id": game_id,
            "season": season_id,
            "date": date,
            "home": opponent_venue == "R",
        })
    for team_games in games.values():
        team_games.sort(key=lambda game: (game["date"], game["game_id"]))
    print(f"  {sum(len(value) for value in games.values())} team-games "
          f"across {len(games)} teams")
    return games


# ── Aggregation ───────────────────────────────────────────────────────
def goals_by_game(rows: Iterable[dict[str, Any]]) -> dict[int, dict[str, int]]:
    """Map game id -> defending team -> position -> goals allowed.

    Keyed by game id so splits can be summed over the team game list, which is
    the only reliable record of games actually played (a shutout produces no
    goal rows at all).
    """
    totals: dict[int, dict[str, dict[str, int]]] = {}
    for row in rows:
        defense = row.get("opponentTeamAbbrev")
        position = POSITION_LABELS.get(row.get("positionCode"))
        goals = row.get("goals") or 0
        game_id = row.get("gameId")
        if not defense or not position or not goals or not isinstance(game_id, int):
            continue
        team = totals.setdefault(game_id, {}).setdefault(
            defense, {key: 0 for key in POSITIONS})
        team[position] += goals
    return totals


def sum_games(
    games: Iterable[dict[str, Any]], team: str,
    goals: dict[int, dict[str, dict[str, int]]],
) -> dict[str, int]:
    totals = {position: 0 for position in POSITIONS}
    for game in games:
        allowed = goals.get(game["game_id"], {}).get(team)
        if not allowed:
            continue
        for position in POSITIONS:
            totals[position] += allowed[position]
    return totals


def select_l10(
    current: list[dict[str, Any]], previous: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """The team's last 10 games played, filled from the previous season."""
    window = current[-L10_GAMES:]
    if len(window) < L10_GAMES:
        fill = previous[-(L10_GAMES - len(window)):] if previous else []
        window = fill + window
    return window


def league_average(teams: dict[str, dict[str, Any]], split: str) -> dict[str, float]:
    count = len(teams) or 1
    return {
        position: round(
            sum(team[split][position] for team in teams.values()) / count, 4)
        for position in POSITIONS
    }


def build_output(
    season_games: dict[str, list[dict[str, Any]]],
    l10_games: dict[str, list[dict[str, Any]]],
    goals: dict[int, dict[str, dict[str, int]]],
    stats_season: int,
    generated_at: datetime,
) -> dict[str, Any]:
    teams: dict[str, dict[str, Any]] = {}
    for team in sorted(NHL_TEAMS):
        games = season_games.get(team, [])
        window = l10_games.get(team, [])
        splits = {
            "ytd": sum_games(games, team, goals),
            "l10": sum_games(window, team, goals),
            "home": sum_games([g for g in games if g["home"]], team, goals),
            "away": sum_games([g for g in games if not g["home"]], team, goals),
        }
        teams[team] = {
            **splits,
            "ytdTotal": sum(splits["ytd"].values()),
            "l10Total": sum(splits["l10"].values()),
            "homeTotal": sum(splits["home"].values()),
            "awayTotal": sum(splits["away"].values()),
            "l10_games": [{"game_id": game["game_id"], "season": game["season"]}
                          for game in window],
            "l10_seasons": sorted({game["season"] for game in window}),
        }

    return {
        "lastUpdated": generated_at.astimezone(timezone.utc).strftime("%Y-%m-%d"),
        "season": season_label(stats_season),
        "season_id": stats_season,
        "positions": list(POSITIONS),
        "teams": teams,
        "league": {
            "l10_avg": league_average(teams, "l10"),
            "ytd_avg": league_average(teams, "ytd"),
        },
    }


# ── Orchestration ─────────────────────────────────────────────────────
def build(session: requests.Session, today: Date, generated_at: datetime) -> dict[str, Any]:
    season_id = current_season_id(today)
    previous_id = previous_season_id(season_id)
    print(f"Current season {season_label(season_id)} ({season_id})")

    current_games = fetch_team_games(session, season_id)
    needs_previous = any(
        len(current_games.get(team, [])) < L10_GAMES for team in NHL_TEAMS)
    previous_games = fetch_team_games(session, previous_id) if needs_previous else {}

    stats_season = season_id if any(current_games.values()) else previous_id
    if stats_season != season_id:
        print(f"No completed {season_label(season_id)} games yet; "
              f"ytd/home/away fall back to {season_label(previous_id)}")
    season_games = current_games if stats_season == season_id else previous_games

    l10_games = {
        team: select_l10(current_games.get(team, []), previous_games.get(team, []))
        for team in NHL_TEAMS
    }

    seasons = {stats_season} | {
        game["season"] for games in l10_games.values() for game in games}
    goals: dict[int, dict[str, dict[str, int]]] = {}
    for season in sorted(seasons):
        goals.update(goals_by_game(fetch_goal_rows(session, season)))

    return build_output(season_games, l10_games, goals, stats_season, generated_at)


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


def summarise(output: dict[str, Any]) -> None:
    league_total = sum(team["ytdTotal"] for team in output["teams"].values())
    print(f"\nSeason {output['season']} ({output['season_id']}): "
          f"{league_total} goals allowed league-wide")
    print(f"League L10 average: {output['league']['l10_avg']}")
    for team in list(sorted(output["teams"]))[:5]:
        data = output["teams"][team]
        print(f"  {team}: YTD {data['ytdTotal']} {data['ytd']} | "
              f"L10 {data['l10Total']} {data['l10']} "
              f"({len(data['l10_games'])} games, seasons {data['l10_seasons']})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--path", type=Path, default=DEFAULT_PATH)
    parser.add_argument("--date", type=lambda value: Date.fromisoformat(value),
                        help="Treat this date as today (YYYY-MM-DD)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    today = args.date or now.date()
    try:
        with requests.Session() as session:
            output = build(session, today, now)
        write_atomic(args.path, output)
    except (requests.RequestException, ValueError, OSError) as error:
        print(f"ERROR: goals against refresh failed: {error}", file=sys.stderr)
        sys.exit(1)
    summarise(output)
    print(f"\nSaved {args.path}")


if __name__ == "__main__":
    main()
