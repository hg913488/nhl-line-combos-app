import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import requests
from scraper import picks_log


NOW = datetime(2026, 10, 10, 15, 0, tzinfo=timezone.utc)
GA_DATA = {
    "lastUpdated": "2026-10-10",
    "season": "2026-27",
    "season_id": 20262027,
    "teams": {
        # TOR indexes: C 0.5, LW 1.25, RW 1.25, D 0.5 -> WATCH LW.
        "TOR": {"l10": {"C": 6, "LW": 5, "RW": 5, "D": 2}},
        "MTL": {"l10": {"C": 12, "LW": 2, "RW": 2, "D": 2}},
        "BOS": {"l10": {"C": 1, "LW": 0, "RW": 0, "D": 8}},
        "NYR": {"l10": {"C": 6, "LW": 1, "RW": 1, "D": 1}},
    },
    "league": {"l10_avg": {"C": 12.0, "LW": 4.0, "RW": 4.0, "D": 4.0}},
}
FIXTURES = Path(__file__).parent / "fixtures"


def game(game_id=2026020001, away="MTL", home="TOR", game_type=2, state="FUT",
         start="2026-10-10T23:00:00Z", **extra):
    return {
        "id": game_id, "season": 20262027, "gameType": game_type,
        "gameState": state, "gameScheduleState": "OK", "startTimeUTC": start,
        "awayTeam": {"abbrev": away}, "homeTeam": {"abbrev": home}, **extra,
    }


def final_game(away_score, home_score, period="REG", **extra):
    base = game(state="OFF", **extra)
    return {**base,
            "awayTeam": {**base["awayTeam"], "score": away_score},
            "homeTeam": {**base["homeTeam"], "score": home_score},
            "gameOutcome": {"lastPeriodType": period}}


def goal(team, position, goals=1):
    return {"teamAbbrev": team, "positionCode": position, "goals": goals}


def logged_doc(games=None):
    doc, _ = picks_log.log_picks(picks_log.empty_document(), "2026-10-10",
                                 games or [game()], GA_DATA, NOW)
    return doc


class RankingTests(unittest.TestCase):
    LEAGUE = {"C": 10.0, "LW": 5.0, "RW": 5.0, "D": 4.0}

    def test_index_beats_raw_goals_so_c_is_not_automatic(self):
        # Raw goals rank C first; against the league average D is the soft spot.
        raw = {"C": 9, "LW": 5, "RW": 4, "D": 6}
        self.assertEqual(max(raw, key=raw.get), "C")
        ranked = picks_log.rank_positions(raw, self.LEAGUE)
        self.assertEqual([p for p, _ in ranked], ["D", "LW", "C", "RW"])
        self.assertEqual(dict(ranked)["D"], 1.5)

    def test_all_tied_keeps_position_order(self):
        ranked = picks_log.rank_positions({"C": 10, "LW": 5, "RW": 5, "D": 4}, self.LEAGUE)
        self.assertEqual([p for p, _ in ranked], ["C", "LW", "RW", "D"])
        self.assertEqual([value for _, value in ranked], [1.0, 1.0, 1.0, 1.0])

    def test_missing_and_non_numeric_values_are_zero(self):
        ranked = picks_log.rank_positions({"LW": None, "RW": "x", "D": 2}, self.LEAGUE)
        self.assertEqual(ranked, [("D", 0.5), ("C", 0.0), ("LW", 0.0), ("RW", 0.0)])
        self.assertEqual(picks_log.rank_positions(None, None)[0], ("C", 0.0))

    def test_zero_league_average_never_divides_by_zero(self):
        ranked = picks_log.rank_positions({"C": 3, "D": 1}, {"C": 0, "D": 2.0})
        self.assertEqual(ranked, [("D", 0.5), ("C", 0.0), ("LW", 0.0), ("RW", 0.0)])

    def test_shared_parity_fixture(self):
        cases = json.loads((FIXTURES / "picks_index_cases.json").read_text())
        self.assertEqual(cases["positions"], list(picks_log.POSITIONS))
        for case in cases["cases"]:
            with self.subTest(case["name"]):
                ranked = picks_log.rank_positions(case["team_l10"], case["league_avg"])
                self.assertEqual([p for p, _ in ranked], case["expected_ranking"])
                self.assertEqual(dict(ranked), case["expected_index"])
                self.assertEqual(ranked[0][0], case["expected_watch"])


class LogTests(unittest.TestCase):
    def test_logs_both_sides_with_signal_and_snapshot(self):
        doc = logged_doc()
        away, home = doc["picks"]
        self.assertEqual((away["offense"], away["defense"], away["venue"]), ("MTL", "TOR", "away"))
        self.assertEqual(away["watch"], "LW")
        self.assertEqual(away["ranking"], ["LW", "RW", "C", "D"])
        self.assertEqual(away["ga_l10"], {"C": 6, "LW": 5, "RW": 5, "D": 2})
        self.assertEqual(away["index"], {"C": 0.5, "LW": 1.25, "RW": 1.25, "D": 0.5})
        self.assertEqual(away["league_l10_avg"], {"C": 12.0, "LW": 4.0, "RW": 4.0, "D": 4.0})
        self.assertEqual(away["ga_snapshot"], {"last_updated": "2026-10-10",
                                               "season": "2026-27", "season_id": 20262027})
        self.assertEqual(home["watch"], "C")
        self.assertEqual(home["id"], "2026020001-TOR")
        self.assertEqual(away["status"], "pending")

    def test_preseason_and_other_game_types_skipped(self):
        games = [game(1, game_type=1), game(2, game_type=4), game(3, game_type=3,
                                                                    away="BOS", home="NYR")]
        doc, added = picks_log.log_picks(picks_log.empty_document(), "2026-10-10",
                                         games, GA_DATA, NOW)
        self.assertEqual(added, 2)
        self.assertEqual({pick["game_id"] for pick in doc["picks"]}, {3})
        self.assertEqual(doc["picks"][0]["game_type"], "playoff")

    def test_no_logging_at_or_after_start(self):
        games = [game(1, start="2026-10-10T15:00:00Z"),
                 game(2, state="LIVE", start="2026-10-10T23:00:00Z"),
                 game(3, gameScheduleState="PPD")]
        _, added = picks_log.log_picks(picks_log.empty_document(), "2026-10-10",
                                       games, GA_DATA, NOW)
        self.assertEqual(added, 0)

    def test_rerun_does_not_duplicate_or_overwrite(self):
        doc = logged_doc()
        changed_ga = {**GA_DATA, "teams": {"TOR": {"l10": {"D": 99}}}}
        later = NOW + timedelta(hours=2)
        again, added = picks_log.log_picks(doc, "2026-10-10", [game()], changed_ga, later)
        self.assertEqual(added, 0)
        self.assertEqual(again["picks"], doc["picks"])

    def test_graded_pick_is_never_relogged(self):
        doc = logged_doc()
        graded, _ = picks_log.grade_picks(
            doc, lambda _: [final_game(1, 1)],
            lambda _: [goal("MTL", "L"), goal("TOR", "C")], NOW + timedelta(days=1))
        again, added = picks_log.log_picks(graded, "2026-10-10", [game()], GA_DATA, NOW)
        self.assertEqual(added, 0)
        self.assertEqual(again["picks"], graded["picks"])


class GradeTests(unittest.TestCase):
    later = NOW + timedelta(days=1)

    def grade(self, schedule_game, rows, now=None, doc=None):
        return picks_log.grade_picks(doc or logged_doc(), lambda _: [schedule_game],
                                     lambda _: rows, now or self.later)

    def test_hit_and_miss(self):
        # MTL watches LW (scored by an L); TOR watches C (only a D scored).
        doc, count = self.grade(final_game(2, 1), [goal("MTL", "L", 2), goal("TOR", "D")])
        self.assertEqual(count, 2)
        away, home = doc["picks"]
        self.assertTrue(away["result"]["hit"])
        self.assertEqual(away["result"]["goals_by_position"], {"C": 0, "LW": 2, "RW": 0, "D": 0})
        self.assertFalse(home["result"]["hit"])
        self.assertEqual(home["status"], "graded")
        self.assertTrue(home["result"]["score_reconciled"])

    def test_shutout_is_a_miss(self):
        doc, _ = self.grade(final_game(0, 1), [goal("TOR", "C")])
        self.assertFalse(doc["picks"][0]["result"]["hit"])
        self.assertTrue(doc["picks"][1]["result"]["hit"])

    def test_shootout_winner_goal_excluded_from_reconciliation(self):
        doc, count = self.grade(final_game(2, 3, period="SO"),
                                [goal("MTL", "R", 2), goal("TOR", "C", 2)])
        self.assertEqual(count, 2)
        self.assertTrue(doc["picks"][1]["result"]["score_reconciled"])

    def test_not_final_stays_pending(self):
        doc, count = self.grade(game(state="LIVE"), [])
        self.assertEqual(count, 0)
        self.assertEqual({pick["status"] for pick in doc["picks"]}, {"pending"})

    def test_unreconciled_stats_defer_then_grade_after_grace(self):
        rows = [goal("TOR", "C")]  # score says 1-2, stats only show one goal
        _, count = self.grade(final_game(1, 2), rows)
        self.assertEqual(count, 0)
        doc, count = self.grade(final_game(1, 2), rows, now=NOW + timedelta(days=3))
        self.assertEqual(count, 2)
        self.assertFalse(doc["picks"][0]["result"]["score_reconciled"])

    def test_postponed_and_missing_games_are_voided(self):
        doc, _ = self.grade(game(gameScheduleState="PPD"), [])
        self.assertEqual({pick["status"] for pick in doc["picks"]}, {"void"})
        doc, count = picks_log.grade_picks(logged_doc(), lambda _: [], lambda _: [],
                                           self.later)
        self.assertEqual(count, 0)
        doc, count = picks_log.grade_picks(logged_doc(), lambda _: [], lambda _: [],
                                           NOW + timedelta(days=4))
        self.assertEqual(count, 2)

    def test_graded_picks_are_not_regraded(self):
        doc, _ = self.grade(final_game(2, 1), [goal("MTL", "L", 2), goal("TOR", "D")])
        calls = []
        again, count = picks_log.grade_picks(doc, lambda d: calls.append(d) or [],
                                             lambda _: [], self.later)
        self.assertEqual((count, calls), (0, []))
        self.assertEqual(again, doc)


class SummaryTests(unittest.TestCase):
    @staticmethod
    def pick(watch, hit, season=20262027, status="graded", scored=None):
        goals = {p: 0 for p in picks_log.POSITIONS}
        goals.update(scored or ({watch: 1} if hit else {}))
        return {"watch": watch, "season": season, "status": status,
                "result": {"hit": hit, "goals_by_position": goals}}

    def test_summary_math(self):
        picks = [self.pick("C", True, scored={"C": 1, "D": 2}), self.pick("C", False),
                 self.pick("LW", True), self.pick("D", False, season=20252026),
                 self.pick("RW", False, status="pending"), self.pick("C", False, status="void")]
        summary = picks_log.build_summary(picks)
        self.assertEqual((summary["graded"], summary["hits"], summary["hit_rate"]), (4, 2, 0.5))
        self.assertEqual((summary["pending"], summary["void"]), (1, 1))
        self.assertEqual(summary["by_position"]["C"], {"graded": 2, "hits": 1, "hit_rate": 0.5})
        self.assertEqual(summary["by_position"]["RW"], {"graded": 0, "hits": 0, "hit_rate": None})
        self.assertEqual(summary["by_season"]["20252026"]["graded"], 1)
        self.assertEqual(summary["baseline_hit_rate"], round(3 / 16, 4))

    def test_empty_summary(self):
        summary = picks_log.build_summary([])
        self.assertEqual((summary["graded"], summary["hit_rate"]), (0, None))

    def test_retention_keeps_two_seasons(self):
        picks = [{"season": s} for s in (20242025, 20252026, 20262027)]
        self.assertEqual([p["season"] for p in picks_log.apply_retention(picks)],
                         [20252026, 20262027])


class FileTests(unittest.TestCase):
    def test_run_writes_atomically_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            path, ga_path = Path(directory) / "picks.json", Path(directory) / "ga.json"
            ga_path.write_text(json.dumps(GA_DATA))
            with patch.object(picks_log, "fetch_schedule", return_value=[game()]):
                picks_log.run("log", path, ga_path, "2026-10-10", NOW)
                first = path.read_text()
                picks_log.run("log", path, ga_path, "2026-10-10", NOW + timedelta(hours=1))
            saved = json.loads(path.read_text())
            self.assertEqual(path.read_text(), first)
            self.assertEqual(list(saved), ["schema_version", "method", "retention",
                                           "summary", "picks"])
            self.assertEqual(saved["summary"]["pending"], 2)
            self.assertEqual([p.name for p in Path(directory).iterdir()
                              if p.name.startswith(".")], [])

    def test_network_failure_leaves_file_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "picks.json"
            path.write_text(json.dumps(logged_doc()))
            before = path.read_text()
            with patch.object(picks_log, "fetch_schedule",
                              side_effect=requests.ConnectionError("down")):
                with self.assertRaises(requests.ConnectionError):
                    picks_log.run("grade", path, Path(directory) / "ga.json", None,
                                  NOW + timedelta(days=1))
            self.assertEqual(path.read_text(), before)

    def test_corrupt_file_is_rejected_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "picks.json"
            path.write_text("{not json")
            with self.assertRaises(ValueError):
                picks_log.load_document(path)

    def test_empty_v1_file_upgrades_and_v1_with_picks_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "picks.json"
            path.write_text(json.dumps({"schema_version": 1, "picks": []}))
            self.assertEqual(picks_log.load_document(path)["schema_version"],
                             picks_log.SCHEMA_VERSION)
            path.write_text(json.dumps({"schema_version": 1,
                                        "picks": [{"id": "x", "season": 20252026}]}))
            with self.assertRaises(ValueError):
                picks_log.load_document(path)

    def test_goals_against_without_league_averages_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            ga_path = Path(directory) / "ga.json"
            ga_path.write_text(json.dumps({"teams": GA_DATA["teams"]}))
            with self.assertRaises(ValueError):
                picks_log.load_ga_data(ga_path)
            ga_path.write_text(json.dumps(GA_DATA))
            self.assertEqual(picks_log.load_ga_data(ga_path)["league"]["l10_avg"]["C"], 12.0)

    def test_no_games_is_success(self):
        with tempfile.TemporaryDirectory() as directory:
            path, ga_path = Path(directory) / "picks.json", Path(directory) / "ga.json"
            ga_path.write_text(json.dumps(GA_DATA))
            with patch.object(picks_log, "fetch_schedule", return_value=[]):
                picks_log.run("all", path, ga_path, "2026-07-01", NOW)
            self.assertEqual(json.loads(path.read_text())["picks"], [])


if __name__ == "__main__":
    unittest.main()
