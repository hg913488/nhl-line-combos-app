import json
import tempfile
import unittest
from datetime import date as Date
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from scraper import scrape_goals_against as ga


NOW = datetime(2026, 3, 15, 12, 0, tzinfo=timezone.utc)


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeAPI:
    """Stats API stand-in. `page_cap` models a server that ignores limit=-1."""

    def __init__(self, rows_for, page_cap=None):
        self.rows_for = rows_for
        self.page_cap = page_cap
        self.calls = []

    def get(self, url, params=None, timeout=None):
        params = params or {}
        self.calls.append((url, params.get("cayenneExp"), params.get("limit")))
        rows = self.rows_for(url, params.get("cayenneExp"), params.get("factCayenneExp"))
        start = int(params.get("start") or 0)
        limit = int(params.get("limit"))
        size = len(rows) if limit < 0 else limit
        if self.page_cap is not None:
            size = min(size, self.page_cap)
        return FakeResponse({"data": rows[start:start + size], "total": len(rows)})


def goal_row(game_id, defense, position, goals=1, date="2026-03-01", player_id=1):
    return {"gameId": game_id, "opponentTeamAbbrev": defense, "positionCode": position,
            "goals": goals, "gameDate": date, "playerId": player_id}


def team_row(game_id, team, opponent_venue="H", date="2026-03-01"):
    """One stats row: `team` is the row's OPPONENT, so `team` played this game."""
    return {"gameId": game_id, "opponentTeamAbbrev": team,
            "homeRoad": opponent_venue, "gameDate": date}


class SeasonTests(unittest.TestCase):
    def test_season_id_flips_on_july_1(self):
        self.assertEqual(ga.current_season_id(Date(2026, 6, 30)), 20252026)
        self.assertEqual(ga.current_season_id(Date(2026, 7, 1)), 20262027)
        self.assertEqual(ga.current_season_id(Date(2026, 9, 19)), 20262027)
        self.assertEqual(ga.current_season_id(Date(2027, 3, 14)), 20262027)

    def test_previous_season_and_label(self):
        self.assertEqual(ga.previous_season_id(20262027), 20252026)
        self.assertEqual(ga.season_label(20252026), "2025-26")
        self.assertEqual(ga.season_label(20092010), "2009-10")


class FetchRowsTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(ga, "DELAY_BETWEEN_REQUESTS", 0)
        patcher.start()
        self.addCleanup(patcher.stop)

    def rows(self, count):
        return [goal_row(2025020000 + index, "TOR", "C", player_id=index)
                for index in range(count)]

    def test_single_request_when_limit_minus_one_is_honoured(self):
        rows = self.rows(250)
        api = FakeAPI(lambda *_: rows)
        fetched = ga.fetch_rows(api, ga.SKATER_SUMMARY_URL, "seasonId=20252026")
        self.assertEqual(len(fetched), 250)
        self.assertEqual(len(api.calls), 1)
        self.assertEqual(api.calls[0][2], -1)

    def test_collects_every_row_when_the_server_caps_the_page_size(self):
        rows = self.rows(250)
        api = FakeAPI(lambda *_: rows, page_cap=100)
        fetched = ga.fetch_rows(api, ga.SKATER_SUMMARY_URL, "seasonId=20252026")
        self.assertEqual(len(fetched), 250)
        self.assertEqual([row["playerId"] for row in fetched], list(range(250)))
        self.assertEqual(len({row["gameId"] for row in fetched}), 250)
        self.assertGreater(len(api.calls), 1)

    def test_paging_stops_on_an_empty_page(self):
        api = FakeAPI(lambda *_: self.rows(5), page_cap=0)
        self.assertEqual(ga.fetch_rows(api, ga.SKATER_SUMMARY_URL, "x"), [])

    def test_bad_payload_is_rejected(self):
        class Broken(FakeAPI):
            def get(self, *args, **kwargs):
                return FakeResponse({"oops": True})

        with self.assertRaises(ValueError):
            ga.fetch_rows(Broken(lambda *_: []), ga.SKATER_SUMMARY_URL, "x")


class TeamGameTests(unittest.TestCase):
    def test_team_games_come_from_the_opponent_rows_and_flip_venue(self):
        rows = [team_row(1, "TOR", "H", "2026-03-02"), team_row(1, "MTL", "R", "2026-03-02"),
                team_row(2, "TOR", "R", "2026-03-01")]
        games = ga.fetch_team_games(FakeAPI(lambda *_: rows), 20252026)
        self.assertEqual([game["game_id"] for game in games["TOR"]], [2, 1])
        self.assertEqual([game["home"] for game in games["TOR"]], [True, False])
        self.assertEqual(games["MTL"][0]["season"], 20252026)

    def test_game_types_are_passed_through(self):
        api = FakeAPI(lambda *_: [])
        ga.fetch_team_games(api, 20252026, game_types=(2, 3))
        self.assertIn("gameTypeId in (2,3)", api.calls[0][1])


class WindowTests(unittest.TestCase):
    @staticmethod
    def games(season, count, start=1):
        return [{"game_id": season + index, "season": season,
                 "date": f"2026-03-{start + index:02d}", "home": index % 2 == 0}
                for index in range(count)]

    def test_uses_the_last_ten_games_played(self):
        window = ga.select_l10(self.games(20252026, 14), [])
        self.assertEqual(len(window), 10)
        self.assertEqual(window[0]["game_id"], 20252026 + 4)

    def test_fills_from_the_previous_season(self):
        window = ga.select_l10(self.games(20262027, 3), self.games(20252026, 25))
        self.assertEqual(len(window), 10)
        self.assertEqual([game["season"] for game in window],
                         [20252026] * 7 + [20262027] * 3)
        self.assertEqual(window[0]["game_id"], 20252026 + 18)

    def test_shutouts_count_as_games_with_zero_goals_against(self):
        games = self.games(20252026, 10)
        goals = ga.goals_by_game([goal_row(games[-1]["game_id"], "TOR", "C", 2)])
        totals = ga.sum_games(games, "TOR", goals)
        self.assertEqual(totals, {"C": 2, "LW": 0, "RW": 0, "D": 0})
        # The nine goal-less games are still part of the window.
        self.assertEqual(len(ga.select_l10(games, [])), 10)


class AggregateTests(unittest.TestCase):
    def test_positions_are_normalised_and_multi_goal_rows_summed(self):
        goals = ga.goals_by_game([
            goal_row(1, "TOR", "L", 2), goal_row(1, "TOR", "R"),
            goal_row(1, "TOR", "D"), goal_row(1, "MTL", "C", 3),
            goal_row(2, "TOR", "C"), {"opponentTeamAbbrev": "TOR"},
        ])
        self.assertEqual(goals[1]["TOR"], {"C": 0, "LW": 2, "RW": 1, "D": 1})
        self.assertEqual(goals[1]["MTL"]["C"], 3)
        self.assertEqual(goals[2]["TOR"]["C"], 1)


class OutputTests(unittest.TestCase):
    def setUp(self):
        self.season_games = {
            "TOR": [{"game_id": 1, "season": 20252026, "date": "2026-03-01", "home": True},
                    {"game_id": 2, "season": 20252026, "date": "2026-03-02", "home": False}],
            "MTL": [{"game_id": 1, "season": 20252026, "date": "2026-03-01", "home": False}],
        }
        self.goals = ga.goals_by_game([
            goal_row(1, "TOR", "C", 2), goal_row(1, "TOR", "D"),
            goal_row(2, "TOR", "L"), goal_row(1, "MTL", "R", 3),
        ])

    def output(self):
        return ga.build_output(self.season_games,
                               {team: games for team, games in self.season_games.items()},
                               self.goals, 20252026, NOW)

    def test_ui_keys_and_new_keys(self):
        team = self.output()["teams"]["TOR"]
        self.assertEqual(sorted(team), ["away", "awayTotal", "home", "homeTotal", "l10",
                                        "l10Total", "l10_games", "l10_seasons", "ytd",
                                        "ytdTotal"])
        self.assertEqual(team["ytd"], {"C": 2, "LW": 1, "RW": 0, "D": 1})
        self.assertEqual((team["ytdTotal"], team["homeTotal"], team["awayTotal"]), (4, 3, 1))
        self.assertEqual(team["home"], {"C": 2, "LW": 0, "RW": 0, "D": 1})
        self.assertEqual(team["l10_games"], [{"game_id": 1, "season": 20252026},
                                             {"game_id": 2, "season": 20252026}])
        self.assertEqual(team["l10_seasons"], [20252026])

    def test_every_team_is_present_even_without_games(self):
        output = self.output()
        self.assertEqual(len(output["teams"]), 32)
        self.assertEqual(output["teams"]["VGK"]["ytdTotal"], 0)
        self.assertEqual(output["teams"]["VGK"]["l10_games"], [])

    def test_league_average_is_the_mean_team_value(self):
        league = self.output()["league"]
        self.assertEqual(league["ytd_avg"]["C"], round(2 / 32, 4))
        self.assertEqual(league["ytd_avg"]["RW"], round(3 / 32, 4))
        self.assertEqual(league["l10_avg"], league["ytd_avg"])
        self.assertEqual(sorted(league), ["l10_avg", "ytd_avg"])

    def test_season_labels(self):
        output = self.output()
        self.assertEqual((output["season"], output["season_id"]), ("2025-26", 20252026))
        self.assertEqual(output["lastUpdated"], "2026-03-15")
        self.assertEqual(output["positions"], ["C", "LW", "RW", "D"])


class BuildTests(unittest.TestCase):
    """End to end against a fake API, including the preseason fallback."""

    @staticmethod
    def api(current_rows, previous_rows, current_goals, previous_goals, **kwargs):
        def rows_for(url, cayenne, fact):
            if url == ga.TEAM_SUMMARY_URL:
                return current_rows if "20262027" in cayenne else previous_rows
            return current_goals if "20262027" in cayenne else previous_goals

        return FakeAPI(rows_for, **kwargs)

    def test_preseason_falls_back_to_the_previous_season(self):
        previous = [team_row(2025020000 + index, "TOR", "H", f"2026-03-{index + 1:02d}")
                    for index in range(12)]
        previous_goals = [goal_row(2025020011, "TOR", "D", 2, "2026-03-12")]
        api = self.api([], previous, [], previous_goals)
        output = ga.build(api, Date(2026, 9, 19), NOW)

        self.assertEqual((output["season"], output["season_id"]), ("2025-26", 20252026))
        team = output["teams"]["TOR"]
        self.assertEqual(team["ytdTotal"], 2)
        self.assertEqual(team["l10Total"], 2)
        self.assertEqual(len(team["l10_games"]), 10)
        self.assertEqual(team["l10_seasons"], [20252026])
        # Two team-summary calls, one goal-row call: the empty season is not fetched.
        self.assertEqual(len(api.calls), 3)

    def test_mid_season_window_crosses_into_the_previous_season(self):
        current = [team_row(2026020000 + index, "TOR", "R", f"2026-10-{index + 1:02d}")
                   for index in range(3)]
        previous = [team_row(2025020000 + index, "TOR", "H", f"2026-03-{index + 1:02d}")
                    for index in range(12)]
        api = self.api(current, previous,
                       [goal_row(2026020002, "TOR", "C", 1, "2026-10-03")],
                       [goal_row(2025020011, "TOR", "L", 2, "2026-03-12")])
        output = ga.build(api, Date(2026, 10, 4), NOW)

        team = output["teams"]["TOR"]
        self.assertEqual((output["season_id"], team["ytdTotal"]), (20262027, 1))
        self.assertEqual(team["l10_seasons"], [20252026, 20262027])
        self.assertEqual(team["l10"], {"C": 1, "LW": 2, "RW": 0, "D": 0})
        self.assertEqual(team["homeTotal"], 1)
        self.assertEqual(team["awayTotal"], 0)

    def test_writes_atomically(self):
        api = self.api([], [team_row(1, "TOR")], [], [goal_row(1, "TOR", "C")])
        output = ga.build(api, Date(2026, 9, 19), NOW)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "goals_against_by_position.json"
            ga.write_atomic(path, output)
            self.assertEqual(json.loads(path.read_text())["season_id"], 20252026)
            self.assertEqual([p.name for p in Path(directory).iterdir()
                              if p.name.startswith(".")], [])


if __name__ == "__main__":
    unittest.main()
