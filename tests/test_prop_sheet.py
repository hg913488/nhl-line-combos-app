import argparse
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from scraper import build_prop_sheet as ps


NOW = datetime(2026, 3, 14, 15, 0, tzinfo=timezone.utc)
DATE = "2026-03-14"
YESTERDAY = "2026-03-13"

LINES = {
    "teams": {
        "toronto-maple-leafs": {
            "forwards": [["MATTHEW KNIES", "AUSTON MATTHEWS", "WILLIAM NYLANDER"],
                         ["BOBBY MCMANN", "JOHN TAVARES", "MITCH MARNER"],
                         ["  ", "MAX DOMI"],
                         ["STEVEN LORENTZ", "DAVID KAMPF", "RYAN REAVES", "EXTRA SKATER"]],
            "defense": [["MORGAN RIELLY", "CHRIS TANEV"], ["JAKE MCCABE", "SIMON BENOIT"]],
            "goalies": [["JOSEPH WOLL"], ["ANTHONY STOLARZ"]],
            "pp1": ["AUSTON MATTHEWS", "WILLIAM NYLANDER", "MORGAN RIELLY"],
            "pp2": ["JOHN TAVARES", "MITCH MARNER", "AUSTON MATTHEWS"],
        },
        "montreal-canadiens": {
            "forwards": [["JURAJ SLAFKOVSKY", "NICK SUZUKI", "COLE CAUFIELD"]],
            "defense": [["MIKE MATHESON", "KAIDEN GUHLE"]],
            "goalies": [["SAM MONTEMBEAULT"]],
            "pp1": ["COLE CAUFIELD"],
            "pp2": [],
        },
    }
}

GA_DATA = {
    "teams": {
        "TOR": {"l10": {"C": 6, "LW": 5, "RW": 5, "D": 2}},
        "MTL": {"l10": {"C": 12, "LW": 8, "RW": 2, "D": 4}},
    },
    "league": {"l10_avg": {"C": 10.0, "LW": 5.0, "RW": 5.0, "D": 4.0}},
}


def game(game_id=2025021043, away="MTL", home="TOR", game_type=2,
         start="2026-03-14T23:00:00Z", **extra):
    return {"id": game_id, "gameType": game_type, "startTimeUTC": start,
            "gameScheduleState": "OK", "awayTeam": {"abbrev": away},
            "homeTeam": {"abbrev": home}, **extra}


def summary_row(player_id, name, team, game_id, date, goals=0, assists=0, shots=0):
    return {"playerId": player_id, "skaterFullName": name, "teamAbbrev": team,
            "gameId": game_id, "gameDate": date, "goals": goals, "assists": assists,
            "points": goals + assists, "shots": shots}


def toi_row(player_id, game_id, seconds, pp_seconds):
    return {"playerId": player_id, "gameId": game_id, "timeOnIce": seconds,
            "ppTimeOnIce": pp_seconds}


class NameTests(unittest.TestCase):
    def test_normalisation_strips_accents_case_and_punctuation(self):
        self.assertEqual(ps.normalize_name("TIM STÜTZLE"), "tim stutzle")
        self.assertEqual(ps.normalize_name("J.T. Miller"), "j t miller")
        self.assertEqual(ps.normalize_name("K'Andre Miller"), "k andre miller")
        self.assertEqual(ps.normalize_name(None), "")

    def test_loose_name_is_initial_plus_surname(self):
        self.assertEqual(ps.loose_name("Mitchell Marner"), ps.loose_name("MITCH MARNER"))
        self.assertEqual(ps.loose_name("Marner"), "")

    def test_matching_exact_accent_insensitive_and_loose(self):
        directory = ps.index_players([
            ("OTT", "Tim Stützle", 8482116),
            ("TOR", "Mitchell Marner", 8478483),
            ("TOR", "Matthew Knies", 8482720),
        ])
        self.assertEqual(ps.match_player(directory, "OTT", "TIM STUTZLE"), 8482116)
        self.assertEqual(ps.match_player(directory, "TOR", "MITCH MARNER"), 8478483)
        self.assertEqual(ps.match_player(directory, "TOR", "MATTHEW KNIES"), 8482720)
        self.assertIsNone(ps.match_player(directory, "MTL", "MATTHEW KNIES"))
        self.assertIsNone(ps.match_player(directory, "TOR", "NOBODY HERE"))

    def test_ambiguous_loose_match_is_not_guessed(self):
        directory = ps.index_players([("TOR", "Sebastian Aho", 1), ("TOR", "Sean Aho", 2)])
        self.assertIsNone(ps.match_player(directory, "TOR", "S. AHO"))

    def test_override_wins(self):
        directory = ps.index_players([("TOR", "Someone Else", 1)])
        key = ("TOR", ps.normalize_name("ALEX NEWGUY"))
        with patch.dict(ps.NAME_OVERRIDES, {key: 99}, clear=False):
            self.assertEqual(ps.match_player(directory, "TOR", "Alex Newguy"), 99)


class RoleTests(unittest.TestCase):
    def setUp(self):
        self.roles = ps.team_roles(LINES["teams"]["toronto-maple-leafs"])
        self.by_name = {role["name"]: role for role in self.roles}

    def test_forward_slots_are_lw_c_rw_by_line(self):
        self.assertEqual((self.by_name["MATTHEW KNIES"]["pos"],
                          self.by_name["AUSTON MATTHEWS"]["pos"],
                          self.by_name["WILLIAM NYLANDER"]["pos"]), ("LW", "C", "RW"))
        self.assertEqual(self.by_name["MATTHEW KNIES"]["line"], "L1")
        self.assertEqual(self.by_name["MITCH MARNER"]["line"], "L2")
        self.assertEqual(self.by_name["DAVID KAMPF"]["line"], "L4")

    def test_defense_pairs_are_d1_d2(self):
        self.assertEqual(self.by_name["MORGAN RIELLY"], {
            "name": "MORGAN RIELLY", "pos": "D", "line": "D1", "pp": 1})
        self.assertEqual(self.by_name["SIMON BENOIT"]["line"], "D2")

    def test_power_play_units_and_pp1_precedence(self):
        self.assertEqual(self.by_name["AUSTON MATTHEWS"]["pp"], 1)
        self.assertEqual(self.by_name["JOHN TAVARES"]["pp"], 2)
        self.assertIsNone(self.by_name["CHRIS TANEV"]["pp"])

    def test_blanks_extra_slots_and_goalies_are_dropped(self):
        names = [role["name"] for role in self.roles]
        self.assertNotIn("EXTRA SKATER", names)
        self.assertNotIn("JOSEPH WOLL", names)
        self.assertNotIn("", names)
        # A short line still maps by slot: MAX DOMI sits in the centre slot.
        self.assertEqual(self.by_name["MAX DOMI"], {
            "name": "MAX DOMI", "pos": "C", "line": "L3", "pp": None})

    def test_missing_team_is_empty(self):
        self.assertEqual(ps.team_roles(None), [])
        self.assertEqual(ps.team_roles({"forwards": "bad"}), [])


class StatsTests(unittest.TestCase):
    def rows(self, count):
        return [summary_row(1, "A B", "TOR", 2000 + index, f"2026-02-{index + 1:02d}",
                            goals=1, assists=1, shots=3)
                for index in range(count)]

    def test_only_the_last_ten_games_count(self):
        toi = {(1, 2000 + index): toi_row(1, 2000 + index, 1200, 120)
               for index in range(12)}
        stats = ps.last10_stats(self.rows(12), toi)
        self.assertEqual(stats, {"gp": 10, "g": 10, "a": 10, "p": 20, "sog": 30,
                                 "toi": 1200.0, "pptoi": 120.0})

    def test_partial_window_and_missing_time_on_ice(self):
        stats = ps.last10_stats(self.rows(2), {(1, 2001): toi_row(1, 2001, 900, 60)})
        self.assertEqual((stats["gp"], stats["p"]), (2, 4))
        self.assertEqual((stats["toi"], stats["pptoi"]), (450.0, 30.0))

    def test_no_games(self):
        self.assertEqual(ps.last10_stats([], {}),
                         {"gp": 0, "g": 0, "a": 0, "p": 0, "sog": 0,
                          "toi": 0.0, "pptoi": 0.0})

    def test_season_stats_default_to_zero(self):
        self.assertEqual(ps.season_stats(None),
                         {"gp": 0, "g": 0, "a": 0, "p": 0, "sog": 0})
        self.assertEqual(ps.season_stats({"gamesPlayed": 60, "goals": 30, "assists": 40,
                                          "points": 70, "shots": 200})["p"], 70)


class FlagTests(unittest.TestCase):
    @staticmethod
    def last10(points=0, goals=0):
        return {"gp": 10, "g": goals, "a": points - goals, "p": points,
                "sog": 0, "toi": 0.0, "pptoi": 0.0}

    def test_flag_order_and_membership(self):
        flags = ps.player_flags(1, True, self.last10(8, 4), True, 1.5)
        self.assertEqual(flags, ["PP1", "ROLE_UP", "HOT", "B2B", "SOFT_MATCHUP"])
        self.assertEqual(ps.player_flags(2, False, self.last10(1, 0), False, 1.0), [])

    def test_hot_thresholds(self):
        self.assertEqual(ps.player_flags(None, False, self.last10(7, 1), False, 0), ["HOT"])
        self.assertEqual(ps.player_flags(None, False, self.last10(6, 4), False, 0), ["HOT"])
        self.assertEqual(ps.player_flags(None, False, self.last10(6, 3), False, 0), [])

    def test_soft_matchup_boundary(self):
        self.assertIn("SOFT_MATCHUP", ps.player_flags(None, False, self.last10(), False, 1.2))
        self.assertNotIn("SOFT_MATCHUP",
                         ps.player_flags(None, False, self.last10(), False, 1.1999))

    def test_opponent_index_uses_league_average(self):
        self.assertEqual(ps.opponent_index(GA_DATA, "MTL", "C"), 1.2)
        self.assertEqual(ps.opponent_index(GA_DATA, "MTL", "RW"), 0.4)
        self.assertEqual(ps.opponent_index(GA_DATA, "NOPE", "C"), 0.0)


class PromotionTests(unittest.TestCase):
    @staticmethod
    def event(hours_ago, changes, player="MITCH MARNER", team="toronto-maple-leafs"):
        occurred = NOW - timedelta(hours=hours_ago)
        return {"occurred_at": occurred.isoformat().replace("+00:00", "Z"),
                "player": player, "team": team, "changes": changes}

    def test_promotions_inside_the_window(self):
        events = {"events": [
            self.event(2, [{"type": "forward_line", "from": 3, "to": 1,
                            "direction": "promoted"}]),
            self.event(10, [{"type": "power_play", "from": None, "to": 2}],
                       player="MAX DOMI"),
            self.event(1, [{"type": "forward_line", "from": 1, "to": 3,
                            "direction": "demoted"}], player="JOHN TAVARES"),
            self.event(60, [{"type": "forward_line", "from": 4, "to": 2,
                             "direction": "promoted"}], player="RYAN REAVES"),
        ]}
        promoted = ps.promoted_players(events, NOW)
        self.assertEqual(promoted, {("toronto-maple-leafs", "MITCH MARNER"),
                                    ("toronto-maple-leafs", "MAX DOMI")})

    def test_bad_input_is_ignored(self):
        self.assertEqual(ps.promoted_players(None, NOW), set())
        self.assertEqual(ps.promoted_players({"events": ["x", {"occurred_at": "nope"}]},
                                             NOW), set())


class GoalieTests(unittest.TestCase):
    DOC = {"matchups": [{
        "date": DATE,
        "away": {"team": "montreal-canadiens", "goalie": "SAM MONTEMBEAULT",
                 "status": "Confirmed"},
        "home": {"team": "toronto-maple-leafs", "goalie": "JOSEPH WOLL",
                 "status": "Likely"},
    }, {
        "date": YESTERDAY,
        "away": {"team": "boston-bruins", "goalie": "JEREMY SWAYMAN", "status": "Confirmed"},
        "home": {"team": "buffalo-sabres", "goalie": "UKKO-PEKKA LUUKKONEN",
                 "status": "Confirmed"},
    }]}

    def test_confirmed_versus_other_statuses(self):
        starters = ps.goalie_matchups(self.DOC, DATE)
        self.assertEqual(starters["montreal-canadiens"],
                         {"name": "SAM MONTEMBEAULT", "status": "Confirmed",
                          "source": "confirmed"})
        self.assertEqual(starters["toronto-maple-leafs"],
                         {"name": "JOSEPH WOLL", "status": "Likely",
                          "source": "projected"})

    def test_other_dates_are_ignored(self):
        self.assertNotIn("boston-bruins", ps.goalie_matchups(self.DOC, DATE))
        self.assertEqual(ps.goalie_matchups(None, DATE), {})

    def test_projected_from_the_depth_chart(self):
        self.assertEqual(ps.projected_goalie(LINES["teams"]["toronto-maple-leafs"]),
                         {"name": "JOSEPH WOLL", "status": "Projected",
                          "source": "projected"})
        self.assertIsNone(ps.projected_goalie({"goalies": []}))


class ScheduleTests(unittest.TestCase):
    def test_game_types_and_postponements(self):
        games = [game(1), game(2, game_type=3), game(3, game_type=1),
                 game(4, gameScheduleState="PPD")]
        self.assertEqual([g["id"] for g in ps.eligible_games(games, False)], [1, 2])
        self.assertEqual([g["id"] for g in ps.eligible_games(games, True)], [1, 2, 3])

    def test_back_to_back_teams_come_from_yesterdays_schedule(self):
        played = ps.teams_that_played([game(1, away="MTL", home="TOR"),
                                       game(2, away="BOS", home="BUF",
                                            gameScheduleState="PPD")])
        self.assertEqual(played, {"MTL", "TOR"})

    def test_window_is_the_last_lookback_games_before_the_date(self):
        current = {"TOR": [{"game_id": index, "season": 20252026,
                            "date": f"2026-03-{index:02d}", "home": True}
                           for index in range(1, 15)]}
        previous = {"TOR": [{"game_id": 100 + index, "season": 20242025,
                             "date": f"2025-04-{index:02d}", "home": False}
                            for index in range(1, 15)]}
        window = ps.team_window("TOR", current, previous, DATE)
        self.assertEqual(len(window), ps.LOOKBACK_TEAM_GAMES)
        self.assertEqual(window[-1]["date"], "2026-03-13")
        self.assertEqual(window[0]["season"], 20242025)


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeSession:
    """Serves the api-web schedule and the stats endpoints from fixtures."""

    def __init__(self, schedules, team_rows, summary_rows, toi_rows, season_rows,
                 rosters=None):
        self.schedules = schedules
        self.rosters = rosters or {}
        self.team_rows = team_rows
        self.summary_rows = summary_rows
        self.toi_rows = toi_rows
        self.season_rows = season_rows
        self.calls = []

    def get(self, url, params=None, timeout=None):
        params = params or {}
        self.calls.append(url)
        if url.startswith("https://api-web.nhle.com/v1/schedule/"):
            date = url.rsplit("/", 1)[-1]
            return FakeResponse({"gameWeek": [{"date": date,
                                               "games": self.schedules.get(date, [])}]})
        if url.startswith("https://api-web.nhle.com/v1/roster/"):
            team = url.split("/")[-2]
            return FakeResponse(self.rosters.get(team, {"forwards": [], "defensemen": []}))
        if url == ps.ga.TEAM_SUMMARY_URL:
            rows = self.team_rows if "20252026" in params["cayenneExp"] else []
        elif url == ps.TIMEONICE_URL:
            rows = self.toi_rows
        elif url == ps.ga.SKATER_SUMMARY_URL:
            rows = (self.season_rows if params.get("isGame") == "false"
                    else self.summary_rows)
        else:
            raise AssertionError(f"unexpected url {url}")
        return FakeResponse({"data": rows, "total": len(rows)})


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        (root / "lines.json").write_text(json.dumps(LINES))
        (root / "ga.json").write_text(json.dumps(GA_DATA))
        (root / "goalies.json").write_text(json.dumps(GoalieTests.DOC))
        (root / "changes.json").write_text(json.dumps({"events": [
            PromotionTests.event(3, [{"type": "forward_line", "from": 3, "to": 2,
                                      "direction": "promoted"}])]}))
        self.args = argparse.Namespace(
            lines=root / "lines.json", ga=root / "ga.json",
            goalies=root / "goalies.json", changes=root / "changes.json",
            out=root / "prop_sheet.json", include_preseason=False)

    def session(self, schedules=None):
        team_rows = [
            # Rows belong to the opponent, so these are TOR and MTL games played.
            {"gameId": 2025021000 + index, "opponentTeamAbbrev": "TOR",
             "homeRoad": "R", "gameDate": f"2026-03-{index + 1:02d}"}
            for index in range(12)
        ] + [
            {"gameId": 2025021000 + index, "opponentTeamAbbrev": "MTL",
             "homeRoad": "H", "gameDate": f"2026-03-{index + 1:02d}"}
            for index in range(12)
        ]
        summary = [summary_row(8479318, "Auston Matthews", "TOR", 2025021000 + index,
                               f"2026-03-{index + 1:02d}", goals=1, shots=5)
                   for index in range(12)]
        summary += [summary_row(8480018, "Nick Suzuki", "MTL", 2025021000 + index,
                                f"2026-03-{index + 1:02d}", assists=1, shots=2)
                    for index in range(12)]
        toi = [toi_row(8479318, 2025021000 + index, 1260, 180) for index in range(12)]
        season = [{"playerId": 8479318, "skaterFullName": "Auston Matthews",
                   "teamAbbrevs": "TOR", "gamesPlayed": 60, "goals": 40, "assists": 30,
                   "points": 70, "shots": 250}]
        rosters = {"TOR": {"forwards": [{"id": 8478483,
                                         "firstName": {"default": "Mitchell"},
                                         "lastName": {"default": "Marner"}}],
                           "defensemen": []}}
        return FakeSession(schedules if schedules is not None else
                           {DATE: [game()], YESTERDAY: [game(2025021042, away="TOR",
                                                             home="OTT")]},
                           team_rows, summary, toi, season, rosters)

    def build(self, session=None):
        return ps.build(session or self.session(), DATE, self.args, NOW)

    def test_document_shape(self):
        document = self.build()
        self.assertEqual(list(document), ["schema_version", "generated_at", "date",
                                          "window", "games", "players"])
        self.assertEqual(document["schema_version"], 1)
        self.assertEqual(document["generated_at"], "2026-03-14T15:00:00Z")
        self.assertEqual(document["date"], DATE)
        self.assertEqual(document["window"], {"games": 10, "seasons": [20252026]})
        self.assertEqual(document["games"], [{"game_id": 2025021043,
                                              "start": "2026-03-14T23:00:00Z",
                                              "away": "MTL", "home": "TOR"}])

    def test_player_row(self):
        players = {player["name"]: player for player in self.build()["players"]}
        matthews = players["AUSTON MATTHEWS"]
        self.assertEqual(list(matthews), ["id", "name", "team", "opp", "game_id", "home",
                                          "pos", "line", "pp", "b2b", "last10", "season",
                                          "opp_index", "opp_goalie", "flags"])
        self.assertEqual((matthews["id"], matthews["team"], matthews["opp"]),
                         (8479318, "TOR", "MTL"))
        self.assertTrue(matthews["home"])
        self.assertEqual((matthews["pos"], matthews["line"], matthews["pp"]),
                         ("C", "L1", 1))
        self.assertEqual(matthews["last10"], {"gp": 10, "g": 10, "a": 0, "p": 10,
                                              "sog": 50, "toi": 1260.0, "pptoi": 180.0})
        self.assertEqual(matthews["season"], {"gp": 60, "g": 40, "a": 30, "p": 70,
                                              "sog": 250})
        self.assertEqual(matthews["opp_index"], 1.2)
        self.assertEqual(matthews["opp_goalie"], {"name": "SAM MONTEMBEAULT",
                                                  "status": "Confirmed",
                                                  "source": "confirmed"})
        self.assertEqual(matthews["flags"], ["PP1", "HOT", "B2B", "SOFT_MATCHUP"])

    def test_flags_promotion_and_back_to_back(self):
        players = {player["name"]: player for player in self.build()["players"]}
        self.assertIn("ROLE_UP", players["MITCH MARNER"]["flags"])
        self.assertTrue(players["MITCH MARNER"]["b2b"])
        # MTL did not play yesterday and faces a below-average RW matchup.
        suzuki = players["NICK SUZUKI"]
        self.assertFalse(suzuki["b2b"])
        self.assertEqual(suzuki["opp_index"], 0.6)
        self.assertEqual(suzuki["flags"], ["HOT"])  # 10 assists in the window
        self.assertEqual(players["JURAJ SLAFKOVSKY"]["flags"], [])
        self.assertEqual(suzuki["opp_goalie"]["source"], "projected")
        self.assertEqual(suzuki["last10"]["gp"], 10)

    def test_unmatched_players_keep_a_null_id(self):
        players = {player["name"]: player for player in self.build()["players"]}
        self.assertIsNone(players["RYAN REAVES"]["id"])
        self.assertEqual(players["RYAN REAVES"]["last10"]["gp"], 0)

    def test_roster_fallback_resolves_names_absent_from_the_stats_window(self):
        session = self.session()
        players = {player["name"]: player
                   for player in ps.build(session, DATE, self.args, NOW)["players"]}
        self.assertEqual(players["MITCH MARNER"]["id"], 8478483)
        self.assertEqual(sum(1 for url in session.calls if "/roster/" in url), 2)

    def test_no_games_writes_an_empty_document(self):
        document = self.build(self.session({DATE: [game(game_type=1)]}))
        self.assertEqual((document["games"], document["players"]), ([], []))
        self.assertEqual(document["window"], {"games": 10, "seasons": []})

    def test_preseason_is_included_only_on_request(self):
        self.args.include_preseason = True
        document = self.build(self.session({DATE: [game(game_type=1)], YESTERDAY: []}))
        self.assertEqual(len(document["games"]), 1)
        self.assertTrue(document["players"])

    def test_written_file_round_trips(self):
        document = self.build()
        ps.ga.write_atomic(self.args.out, document)
        self.assertEqual(json.loads(self.args.out.read_text()), document)


if __name__ == "__main__":
    unittest.main()
