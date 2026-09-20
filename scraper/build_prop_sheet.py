"""Build today's player prop sheet: data/prop_sheet.json.

Run from the repository root as `python -m scraper.build_prop_sheet` (the module
reuses helpers from scraper/scrape_goals_against.py and scraper/picks_log.py).

What it produces
----------------
One row per skater in a starting lineup for today's games, carrying the role
(line, PP unit), recent form, the opponent's softness at that skater's position,
the opposing goalie and a small set of flags.

Inputs
    data/lines.json            Roles. Forward lines are slot ordered LW, C, RW
                               and defense pairs LD, RD (DailyFaceOff
                               positionIdentifier, see scraper/scrape_lines.py).
    data/goalies.json          Today's goalie matchups; `status` "Confirmed"
                               is the only status that yields source
                               "confirmed", anything else is "projected".
    data/lineup_changes.json   Promotions for the ROLE_UP flag.
    data/goals_against_by_position.json
                               Opponent L10 goals allowed plus league averages,
                               used for opp_index (same index as the Picks tab).
    api-web.nhle.com           Schedule for today and yesterday (B2B).
    api.nhle.com/stats/rest    Skater summary + time on ice, bulk date-window
                               calls with limit=-1, aggregated per player.

Rules and constants
    last10          A player's most recent 10 games (regular season or
                    playoffs) inside their team's last LOOKBACK_TEAM_GAMES
                    games, so the window crosses into the previous season early
                    in a season. gp is what was actually found; toi/pptoi are
                    seconds per game.
    season          Season totals for the current season, or the previous
                    season while the current one has no completed games.
    opp_index       opponent L10 goals allowed at this position / league
                    average at that position. 1.00 = league average.
    HOT             last10 points >= 7 or last10 goals >= 4.
    SOFT_MATCHUP    opp_index >= 1.20.
    ROLE_UP         a promotion (line, pair, or PP unit gained/improved) in
                    data/lineup_changes.json within the last 48 hours.
    B2B             the player's team played the previous calendar day.
    PP1             the player is on the first power play unit.

Exits 0 with empty games/players lists when there are no games.
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
from typing import Any, Iterable

import requests

# Runs both as `python scraper/build_prop_sheet.py` (workflows) and as a module,
# so put the repository root on the path before importing sibling scrapers.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scraper import scrape_goals_against as ga  # noqa: E402
from scraper.picks_log import EASTERN, position_index  # noqa: E402

SCHEMA_VERSION = 1
LAST10_GAMES = 10
LOOKBACK_TEAM_GAMES = 20
HOT_POINTS = 7
HOT_GOALS = 4
SOFT_MATCHUP_INDEX = 1.20
ROLE_UP_WINDOW_HOURS = 48
PROP_GAME_TYPES = (2, 3)
PRESEASON_GAME_TYPE = 1
CONFIRMED_STATUS = "confirmed"
PROJECTED_STATUS = "Projected"
FLAG_ORDER = ("PP1", "ROLE_UP", "HOT", "B2B", "SOFT_MATCHUP")
FORWARD_SLOTS = ("LW", "C", "RW")
VOID_SCHEDULE_STATES = {"PPD", "CNCL"}

SCHEDULE_URL = "https://api-web.nhle.com/v1/schedule/{date}"
ROSTER_URL = "https://api-web.nhle.com/v1/roster/{team}/{season}"
TIMEONICE_URL = f"{ga.STATS_BASE}/skater/timeonice"
REQUEST_TIMEOUT = 30

DEFAULT_OUT = Path("data/prop_sheet.json")
DEFAULT_LINES = Path("data/lines.json")
DEFAULT_GOALIES = Path("data/goalies.json")
DEFAULT_CHANGES = Path("data/lineup_changes.json")
DEFAULT_GA = Path("data/goals_against_by_position.json")

# DailyFaceOff slugs (lines.json / goalies.json keys) by NHL team abbreviation.
TEAM_SLUGS = {
    "ANA": "anaheim-ducks", "BOS": "boston-bruins", "BUF": "buffalo-sabres",
    "CAR": "carolina-hurricanes", "CBJ": "columbus-blue-jackets",
    "CGY": "calgary-flames", "CHI": "chicago-blackhawks", "COL": "colorado-avalanche",
    "DAL": "dallas-stars", "DET": "detroit-red-wings", "EDM": "edmonton-oilers",
    "FLA": "florida-panthers", "LAK": "los-angeles-kings", "MIN": "minnesota-wild",
    "MTL": "montreal-canadiens", "NJD": "new-jersey-devils",
    "NSH": "nashville-predators", "NYI": "new-york-islanders",
    "NYR": "new-york-rangers", "OTT": "ottawa-senators", "PHI": "philadelphia-flyers",
    "PIT": "pittsburgh-penguins", "SEA": "seattle-kraken", "SJS": "san-jose-sharks",
    "STL": "st-louis-blues", "TBL": "tampa-bay-lightning", "TOR": "toronto-maple-leafs",
    "UTA": "utah-mammoth", "VAN": "vancouver-canucks", "VGK": "vegas-golden-knights",
    "WPG": "winnipeg-jets", "WSH": "washington-capitals",
}

# Verified playerIds for lineup names the normalised match cannot reach.
# Keyed by (team abbreviation, normalised lineup name).
NAME_OVERRIDES: dict[tuple[str, str], int] = {}


# ── Names ─────────────────────────────────────────────────────────────
def normalize_name(value: Any) -> str:
    """Casefold, strip accents and punctuation: "J.T. Miller" -> "jt miller"."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = "".join(char if char.isalnum() else " " for char in text.lower())
    return " ".join(text.split())


def loose_name(value: str) -> str:
    """First initial plus surname: matches "Mitch"/"Mitchell Marner"."""
    parts = normalize_name(value).split()
    return f"{parts[0][0]} {' '.join(parts[1:])}" if len(parts) > 1 else ""


def index_players(entries: Iterable[tuple[str, str, int]]) -> dict[str, Any]:
    """Build the lookup from (team, full name, player id) triples."""
    exact: dict[tuple[str, str], int] = {}
    loose: dict[tuple[str, str], set[int]] = defaultdict(set)
    for team, name, player_id in entries:
        if not team or not name or not isinstance(player_id, int):
            continue
        exact.setdefault((team, normalize_name(name)), player_id)
        key = loose_name(name)
        if key:
            loose[(team, key)].add(player_id)
    return {"exact": exact, "loose": loose}


def match_player(directory: dict[str, Any], team: str, name: str) -> int | None:
    key = (team, normalize_name(name))
    if key in NAME_OVERRIDES:
        return NAME_OVERRIDES[key]
    if key in directory["exact"]:
        return directory["exact"][key]
    candidates = directory["loose"].get((team, loose_name(name)), set())
    return next(iter(candidates)) if len(candidates) == 1 else None


# ── Roles from lines.json ─────────────────────────────────────────────
def team_roles(team: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Skaters with their position, line label and power play unit.

    Forward lines are slot ordered LW, C, RW; defense pairs are both D. Slots
    beyond the third forward are ignored: the source has no position for them.
    """
    team = team if isinstance(team, dict) else {}
    power_play = {}
    for unit in (2, 1):  # PP1 wins if a name appears on both units
        for name in team.get(f"pp{unit}") or []:
            if isinstance(name, str) and name.strip():
                power_play[name.strip()] = unit

    players: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(name: Any, position: str, line: str) -> None:
        if not isinstance(name, str) or not name.strip() or name.strip() in seen:
            return
        name = name.strip()
        seen.add(name)
        players.append({"name": name, "pos": position, "line": line,
                        "pp": power_play.get(name)})

    for index, group in enumerate(team.get("forwards") or [], start=1):
        for slot, name in enumerate(group if isinstance(group, list) else []):
            if slot < len(FORWARD_SLOTS):
                add(name, FORWARD_SLOTS[slot], f"L{index}")
    for index, pair in enumerate(team.get("defense") or [], start=1):
        for name in pair if isinstance(pair, list) else []:
            add(name, "D", f"D{index}")
    return players


# ── Lineup changes ────────────────────────────────────────────────────
def _is_promotion(change: dict[str, Any]) -> bool:
    if change.get("direction") == "promoted":
        return True
    # A player who was not on a power play unit and now is has no direction.
    return (change.get("type") == "power_play" and change.get("from") is None
            and change.get("to") is not None)


def promoted_players(changes: dict[str, Any] | None, now: datetime) -> set[tuple[str, str]]:
    """(team slug, upper-case player name) promoted within the last 48 hours."""
    cutoff = now - timedelta(hours=ROLE_UP_WINDOW_HOURS)
    promoted: set[tuple[str, str]] = set()
    for event in (changes or {}).get("events") or []:
        if not isinstance(event, dict):
            continue
        try:
            occurred = datetime.fromisoformat(
                str(event.get("occurred_at", "")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if occurred.tzinfo is None:
            occurred = occurred.replace(tzinfo=timezone.utc)
        if occurred < cutoff:
            continue
        if any(_is_promotion(change) for change in event.get("changes") or []):
            promoted.add((event.get("team"), str(event.get("player", "")).upper()))
    return promoted


# ── Goalies ───────────────────────────────────────────────────────────
def goalie_matchups(goalies: dict[str, Any] | None, game_date: str) -> dict[str, dict[str, Any]]:
    """Starting goalie per team slug for `game_date`."""
    starters: dict[str, dict[str, Any]] = {}
    for matchup in (goalies or {}).get("matchups") or []:
        if not isinstance(matchup, dict):
            continue
        if matchup.get("date") and matchup["date"] != game_date:
            continue
        for side in ("away", "home"):
            entry = matchup.get(side) or {}
            slug, name = entry.get("team"), entry.get("goalie")
            if not slug or not name:
                continue
            status = entry.get("status") or "Unconfirmed"
            starters[slug] = {
                "name": name,
                "status": status,
                "source": "confirmed" if status.strip().lower() == CONFIRMED_STATUS
                          else "projected",
            }
    return starters


def projected_goalie(team: dict[str, Any] | None) -> dict[str, Any] | None:
    """First goalie on the depth chart, used when no matchup is published."""
    for group in (team or {}).get("goalies") or []:
        names = group if isinstance(group, list) else [group]
        for name in names:
            if isinstance(name, str) and name.strip():
                return {"name": name.strip(), "status": PROJECTED_STATUS,
                        "source": "projected"}
    return None


# ── Stats ─────────────────────────────────────────────────────────────
def last10_stats(
    rows: list[dict[str, Any]], toi: dict[tuple[int, int], dict[str, Any]],
) -> dict[str, Any]:
    """Aggregate a player's most recent LAST10_GAMES game rows."""
    games = sorted(rows, key=lambda row: (row.get("gameDate") or "", row.get("gameId") or 0),
                   reverse=True)[:LAST10_GAMES]
    played = len(games)
    totals = {
        "gp": played,
        "g": sum(row.get("goals") or 0 for row in games),
        "a": sum(row.get("assists") or 0 for row in games),
        "p": sum(row.get("points") or 0 for row in games),
        "sog": sum(row.get("shots") or 0 for row in games),
    }
    ice = [toi.get((row.get("playerId"), row.get("gameId")), {}) for row in games]
    totals["toi"] = round(sum(entry.get("timeOnIce") or 0 for entry in ice) / played, 1) \
        if played else 0.0
    totals["pptoi"] = round(sum(entry.get("ppTimeOnIce") or 0 for entry in ice) / played, 1) \
        if played else 0.0
    return totals


def season_stats(row: dict[str, Any] | None) -> dict[str, int]:
    row = row or {}
    return {
        "gp": row.get("gamesPlayed") or 0,
        "g": row.get("goals") or 0,
        "a": row.get("assists") or 0,
        "p": row.get("points") or 0,
        "sog": row.get("shots") or 0,
    }


def player_flags(
    pp: int | None, role_up: bool, last10: dict[str, Any], b2b: bool, opp_index: float,
) -> list[str]:
    flags = {
        "PP1": pp == 1,
        "ROLE_UP": role_up,
        "HOT": last10["p"] >= HOT_POINTS or last10["g"] >= HOT_GOALS,
        "B2B": b2b,
        "SOFT_MATCHUP": opp_index >= SOFT_MATCHUP_INDEX,
    }
    return [flag for flag in FLAG_ORDER if flags[flag]]


def opponent_index(ga_data: dict[str, Any], opponent: str, position: str) -> float:
    league = (ga_data.get("league") or {}).get("l10_avg") or {}
    allowed = ((ga_data.get("teams") or {}).get(opponent) or {}).get("l10") or {}
    return position_index(allowed.get(position), league.get(position))


# ── NHL API ───────────────────────────────────────────────────────────
def fetch_schedule_day(session: requests.Session, game_date: str) -> list[dict[str, Any]]:
    response = session.get(SCHEDULE_URL.format(date=game_date), timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    week = response.json().get("gameWeek")
    if not isinstance(week, list):
        raise ValueError(f"Schedule response for {game_date} has no gameWeek")
    day = next((item for item in week if item.get("date") == game_date), None)
    return day.get("games", []) if day else []


def fetch_roster(session: requests.Session, team: str, season_id: int) -> list[tuple[str, str, int]]:
    response = session.get(ROSTER_URL.format(team=team, season=season_id),
                           timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    entries = []
    for key in ("forwards", "defensemen"):
        for player in payload.get(key) or []:
            first = (player.get("firstName") or {}).get("default", "")
            last = (player.get("lastName") or {}).get("default", "")
            entries.append((team, f"{first} {last}", player.get("id")))
    return entries


def fetch_window_rows(
    session: requests.Session, start: str, end: str,
) -> tuple[list[dict[str, Any]], dict[tuple[int, int], dict[str, Any]]]:
    types = ",".join(str(value) for value in PROP_GAME_TYPES)
    cayenne = (f'gameDate>="{start}" and gameDate<="{end}" '
               f"and gameTypeId in ({types})")
    print(f"Fetching skater games {start} to {end}...")
    summary = ga.fetch_rows(session, ga.SKATER_SUMMARY_URL, cayenne)
    ice = ga.fetch_rows(session, TIMEONICE_URL, cayenne)
    print(f"  {len(summary)} summary rows, {len(ice)} time-on-ice rows")
    return summary, {(row.get("playerId"), row.get("gameId")): row for row in ice}


def fetch_season_rows(
    session: requests.Session, season_id: int, end: str,
) -> dict[int, dict[str, Any]]:
    print(f"Fetching {ga.season_label(season_id)} season totals through {end}...")
    rows = ga.fetch_rows(
        session, ga.SKATER_SUMMARY_URL,
        cayenne=(f"seasonId={season_id} and gameTypeId={ga.REGULAR_SEASON} "
                 f'and gameDate<="{end}"'),
        is_game=False,
    )
    print(f"  {len(rows)} player rows")
    return {row["playerId"]: row for row in rows if isinstance(row.get("playerId"), int)}


# ── Assembly ──────────────────────────────────────────────────────────
def eligible_games(games: list[dict[str, Any]], include_preseason: bool) -> list[dict[str, Any]]:
    types = set(PROP_GAME_TYPES) | ({PRESEASON_GAME_TYPE} if include_preseason else set())
    return [game for game in games
            if game.get("gameType") in types
            and game.get("gameScheduleState", "OK") not in VOID_SCHEDULE_STATES]


def teams_that_played(games: list[dict[str, Any]]) -> set[str]:
    return {game[side]["abbrev"] for game in games for side in ("awayTeam", "homeTeam")
            if game.get("gameScheduleState", "OK") not in VOID_SCHEDULE_STATES}


def team_window(
    team: str, current: dict[str, list[dict[str, Any]]],
    previous: dict[str, list[dict[str, Any]]], before: str,
) -> list[dict[str, Any]]:
    games = [game for game in previous.get(team, []) + current.get(team, [])
             if game["date"] < before]
    return games[-LOOKBACK_TEAM_GAMES:]


def build_players(
    games: list[dict[str, Any]], lines: dict[str, Any], goalies: dict[str, dict[str, Any]],
    promoted: set[tuple[str, str]], played_yesterday: set[str], ga_data: dict[str, Any],
    directory: dict[str, Any], window_rows: dict[int, list[dict[str, Any]]],
    toi: dict[tuple[int, int], dict[str, Any]], season_rows: dict[int, dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    teams = lines.get("teams") or {}
    players: list[dict[str, Any]] = []
    unmatched: list[str] = []

    for game in games:
        for side, opposite in (("awayTeam", "homeTeam"), ("homeTeam", "awayTeam")):
            team = game[side]["abbrev"]
            opponent = game[opposite]["abbrev"]
            slug, opponent_slug = TEAM_SLUGS.get(team), TEAM_SLUGS.get(opponent)
            opp_goalie = goalies.get(opponent_slug) or projected_goalie(
                teams.get(opponent_slug))
            b2b = team in played_yesterday

            for role in team_roles(teams.get(slug)):
                player_id = match_player(directory, team, role["name"])
                if player_id is None:
                    unmatched.append(f"{team} {role['name']}")
                last10 = last10_stats(window_rows.get(player_id, []), toi)
                index = opponent_index(ga_data, opponent, role["pos"])
                players.append({
                    "id": player_id,
                    "name": role["name"],
                    "team": team,
                    "opp": opponent,
                    "game_id": game["id"],
                    "home": side == "homeTeam",
                    "pos": role["pos"],
                    "line": role["line"],
                    "pp": role["pp"],
                    "b2b": b2b,
                    "last10": last10,
                    "season": season_stats(season_rows.get(player_id)),
                    "opp_index": index,
                    "opp_goalie": opp_goalie,
                    "flags": player_flags(
                        role["pp"], (slug, role["name"].upper()) in promoted,
                        last10, b2b, index),
                })
    return players, unmatched


def build_document(
    game_date: str, games: list[dict[str, Any]], players: list[dict[str, Any]],
    seasons: list[int], generated_at: datetime,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at.astimezone(timezone.utc).replace(
            microsecond=0).isoformat().replace("+00:00", "Z"),
        "date": game_date,
        "window": {"games": LAST10_GAMES, "seasons": seasons},
        "games": [{
            "game_id": game["id"],
            "start": game["startTimeUTC"],
            "away": game["awayTeam"]["abbrev"],
            "home": game["homeTeam"]["abbrev"],
        } for game in games],
        "players": players,
    }


def build(
    session: requests.Session, game_date: str, args: argparse.Namespace, now: datetime,
) -> dict[str, Any]:
    games = eligible_games(fetch_schedule_day(session, game_date), args.include_preseason)
    games.sort(key=lambda game: (game["startTimeUTC"], game["id"]))
    print(f"{game_date}: {len(games)} eligible game(s)")
    if not games:
        return build_document(game_date, [], [], [], now)

    lines = load_json(args.lines)
    ga_data = load_json(args.ga)
    goalies = goalie_matchups(load_json(args.goalies, required=False), game_date)
    promoted = promoted_players(load_json(args.changes, required=False), now)

    yesterday = (Date.fromisoformat(game_date) - timedelta(days=1)).isoformat()
    played_yesterday = teams_that_played(fetch_schedule_day(session, yesterday))

    playing = sorted(teams_that_played(games))
    season_id = ga.current_season_id(Date.fromisoformat(game_date))
    current = ga.fetch_team_games(session, season_id, PROP_GAME_TYPES)
    needs_previous = any(
        len([g for g in current.get(team, []) if g["date"] < game_date])
        < LOOKBACK_TEAM_GAMES for team in playing)
    previous = ga.fetch_team_games(session, ga.previous_season_id(season_id),
                                   PROP_GAME_TYPES) if needs_previous else {}

    windows = {team: team_window(team, current, previous, game_date) for team in playing}
    dates = sorted(game["date"] for window in windows.values() for game in window)
    seasons = sorted({game["season"] for window in windows.values() for game in window})
    if not dates:
        print("WARNING: no completed games found for any team; last10 will be empty")
    window_start = dates[0] if dates else game_date
    window_end = yesterday

    summary_rows, toi = fetch_window_rows(session, window_start, window_end)
    by_player: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in summary_rows:
        if isinstance(row.get("playerId"), int):
            by_player[row["playerId"]].append(row)

    stats_season = season_id if any(current.values()) else ga.previous_season_id(season_id)
    season_rows = fetch_season_rows(session, stats_season, window_end)

    directory = index_players(
        [(row.get("teamAbbrev"), row.get("skaterFullName"), row.get("playerId"))
         for row in summary_rows]
        + [(team, row.get("skaterFullName"), row.get("playerId"))
           for row in season_rows.values()
           for team in str(row.get("teamAbbrevs") or "").split(",") if team]
    )
    players, unmatched = build_players(games, lines, goalies, promoted, played_yesterday,
                                       ga_data, directory, by_player, toi, season_rows)

    if unmatched:
        directory = add_rosters(session, directory, unmatched, season_id)
        players, unmatched = build_players(games, lines, goalies, promoted,
                                           played_yesterday, ga_data, directory,
                                           by_player, toi, season_rows)
    for name in unmatched:
        print(f"WARNING: no playerId for {name}")
    print(f"{len(players)} player rows, {len(unmatched)} unmatched")
    return build_document(game_date, games, players, seasons, now)


def add_rosters(
    session: requests.Session, directory: dict[str, Any], unmatched: list[str],
    season_id: int,
) -> dict[str, Any]:
    """Second pass: club rosters for the teams whose lineup names did not match."""
    teams = sorted({name.split(" ", 1)[0] for name in unmatched})
    print(f"Fetching rosters for {len(teams)} team(s) with unmatched names: "
          f"{', '.join(teams)}")
    entries: list[tuple[str, str, int]] = []
    for team in teams:
        try:
            entries.extend(fetch_roster(session, team, season_id))
        except (requests.RequestException, ValueError) as error:
            print(f"  roster fetch failed for {team}: {error}")
    extra = index_players(entries)
    merged_loose = defaultdict(set, {key: set(value)
                                     for key, value in directory["loose"].items()})
    for key, value in extra["loose"].items():
        merged_loose[key] |= value
    return {"exact": {**extra["exact"], **directory["exact"]}, "loose": merged_loose}


# ── IO ────────────────────────────────────────────────────────────────
def load_json(path: Path, required: bool = True) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if required:
            raise
        print(f"  {path} not found; continuing without it")
        return {}
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return value


def summarise(document: dict[str, Any]) -> None:
    players = document["players"]
    flags = defaultdict(int)
    for player in players:
        for flag in player["flags"]:
            flags[flag] += 1
    matched = sum(1 for player in players if player["id"])
    print(f"\n{len(document['games'])} game(s), {len(players)} players "
          f"({matched} matched to a playerId)")
    print(f"Flags: {dict(flags) or 'none'}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--date", type=lambda value: Date.fromisoformat(value).isoformat(),
                        help="Game date (YYYY-MM-DD); default today in New York")
    parser.add_argument("--include-preseason", action="store_true",
                        help="Include preseason games (testing only)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--lines", type=Path, default=DEFAULT_LINES)
    parser.add_argument("--goalies", type=Path, default=DEFAULT_GOALIES)
    parser.add_argument("--changes", type=Path, default=DEFAULT_CHANGES)
    parser.add_argument("--ga", type=Path, default=DEFAULT_GA)
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    game_date = args.date or now.astimezone(EASTERN).date().isoformat()
    try:
        with requests.Session() as session:
            document = build(session, game_date, args, now)
        ga.write_atomic(args.out, document)
    except (requests.RequestException, ValueError, OSError) as error:
        print(f"ERROR: prop sheet build failed: {error}", file=sys.stderr)
        sys.exit(1)
    summarise(document)
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
