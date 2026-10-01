import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from scraper import scrape_lines as scraper


class InjuryFallbackTests(unittest.TestCase):
    def run_scraper(self, previous=None, failure=None, injuries=None):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "lines.json"
            if previous is not None:
                output.write_text(json.dumps(previous))
            lineup = {"forwards": [["NEW PLAYER"]], "defense": [],
                      "goalies": [], "pp1": [], "pp2": []}
            with patch.object(scraper, "OUTPUT_PATH", str(output)), \
                 patch.object(scraper, "TEAMS", ["test-team"]), \
                 patch.object(scraper, "scrape_team", return_value=lineup), \
                 patch.object(scraper.time, "sleep"), \
                 patch.object(scraper, "fetch_espn_team_ids",
                              side_effect=failure, return_value={"test-team": 1}), \
                 patch.object(scraper, "scrape_espn_injuries", return_value=injuries or {}):
                scraper.main()
            result = json.loads(output.read_text())
            self.assertEqual(result["teams"]["test-team"], lineup)
            return result

    def test_403_preserves_injuries_and_saves_new_lineups(self):
        saved = {"test-team": [{"name": "INJURED PLAYER"}]}
        result = self.run_scraper({"injuries": saved,
                                   "injuries_meta": {"updated_at": "2026-06-01"}},
                                  requests.HTTPError("403 Forbidden"))
        self.assertEqual(result["injuries"], saved)
        self.assertEqual(result["injuries_meta"]["status"], "stale")
        self.assertEqual(result["injuries_meta"]["updated_at"], "2026-06-01")

    def test_no_snapshot_marks_injuries_unavailable(self):
        result = self.run_scraper(failure=requests.Timeout())
        self.assertEqual(result["injuries_meta"]["status"], "unavailable")
        self.assertIsNone(result["injuries_meta"]["updated_at"])

    def test_legacy_snapshot_does_not_invent_injury_timestamp(self):
        result = self.run_scraper({"updated_at": "2026-06-01", "injuries": {}},
                                  requests.HTTPError())
        self.assertIsNone(result["injuries_meta"]["updated_at"])

    def test_successful_empty_feed_clears_old_injuries(self):
        result = self.run_scraper({"injuries": {"test-team": [{"name": "OLD"}]}})
        self.assertEqual(result["injuries"], {})
        self.assertEqual(result["injuries_meta"]["status"], "fresh")

    def test_partial_team_failure_rejects_entire_refresh(self):
        ok = Mock()
        ok.json.return_value = {"items": [], "count": 0}
        with patch.object(scraper.SESSION, "get", side_effect=[ok, requests.HTTPError()]), \
             patch.object(scraper.time, "sleep"):
            with self.assertRaisesRegex(ValueError, "incomplete"):
                scraper.scrape_espn_injuries({"one": 1, "two": 2})

    def test_malformed_feed_is_not_treated_as_no_injuries(self):
        response = Mock()
        response.json.return_value = {"error": "Forbidden"}
        with patch.object(scraper.SESSION, "get", return_value=response):
            with self.assertRaises(ValueError):
                scraper.scrape_espn_injuries({"one": 1})

    def test_incomplete_mapping_is_rejected(self):
        response = Mock()
        response.json.return_value = {"sports": []}
        with patch.object(scraper.SESSION, "get", return_value=response):
            with self.assertRaisesRegex(ValueError, "mapping"):
                scraper.fetch_espn_team_ids()


class DailyFaceoffInjuryTests(unittest.TestCase):
    NOW = datetime(2026, 10, 1, tzinfo=timezone.utc)

    def test_injured_players_come_from_the_lineup_page(self):
        players = [
            {"name": "Healthy Guy", "positionIdentifier": "c", "injuryStatus": None},
            {"name": "A.J. Greer", "positionIdentifier": "lw", "injuryStatus": "dtd"},
            {"name": "Kevin Fiala", "positionIdentifier": "ir1", "injuryStatus": "out",
             "latestNews": {"createdAt": "2026-09-17T10:00:00-04:00",
                            "details": "Kevin Fiala (lower-body) could rejoin his teammates soon."}},
            {"name": "Old News", "positionIdentifier": "ir2", "injuryStatus": "ir",
             "latestNews": {"createdAt": "2025-11-08T15:25:28-05:00",
                            "details": "Old News (upper-body) will miss three months."}},
            {"name": "Connor Bedard", "positionIdentifier": "ir3", "injuryStatus": "out",
             "latestNews": {"createdAt": "2026-09-20T19:59:00-04:00",
                            "details": "5-year contract. Expires 2031 (UFA)."}},
        ]
        self.assertEqual(scraper.df_injuries(players, self.NOW), [
            {"name": "A.J. GREER", "pos": "LW", "status": "Day-To-Day", "desc": ""},
            {"name": "KEVIN FIALA", "pos": "?", "status": "Out", "desc": "Lower body"},
            {"name": "OLD NEWS", "pos": "?", "status": "Injured Reserve", "desc": ""},
            {"name": "CONNOR BEDARD", "pos": "?", "status": "Out", "desc": ""},
        ])

    def test_positions_filled_from_the_nhl_roster(self):
        injuries = {"florida-panthers": [{"name": "BRAD MARCHAND", "pos": "?"},
                                         {"name": "RADKO GUDAS", "pos": "D"}]}
        roster = Mock()
        roster.json.return_value = {"forwards": [
            {"firstName": {"default": "Brad"}, "lastName": {"default": "Marchand"},
             "positionCode": "L"}], "defensemen": [], "goalies": []}
        with patch.object(scraper.SESSION, "get", return_value=roster) as get, \
             patch.object(scraper.time, "sleep"):
            scraper.fill_positions(injuries, {"florida-panthers": "FLA"})
        self.assertIn("/roster/FLA/", get.call_args[0][0])
        self.assertEqual(injuries["florida-panthers"][0]["pos"], "LW")

    def test_injured_reserve_players_missing_from_roster_are_searched(self):
        injuries = {"chicago-blackhawks": [{"name": "CONNOR BEDARD", "pos": "?"}]}
        roster, search = Mock(), Mock()
        roster.json.return_value = {"forwards": [], "defensemen": [], "goalies": []}
        search.json.return_value = [
            {"name": "Connor Bédard", "positionCode": "C", "teamAbbrev": "CHI"},
            {"name": "Connor Bedard", "positionCode": "D", "teamAbbrev": "XYZ"},
        ]
        with patch.object(scraper.SESSION, "get", side_effect=[roster, search]), \
             patch.object(scraper.time, "sleep"):
            scraper.fill_positions(injuries, {"chicago-blackhawks": "CHI"})
        self.assertEqual(injuries["chicago-blackhawks"][0]["pos"], "C")

    def test_search_accepts_a_short_first_name_on_the_same_team(self):
        search = Mock()
        search.json.return_value = [{"name": "Matt Savoie", "positionCode": "C", "teamAbbrev": "EDM"},
                                    {"name": "Samuel Savoie", "positionCode": "L", "teamAbbrev": "CHI"}]
        with patch.object(scraper.SESSION, "get", return_value=search):
            self.assertEqual(scraper.search_position("MATTHEW SAVOIE", "EDM"), "C")
            self.assertEqual(scraper.search_position("MATTHEW SAVOIE", "TOR"), "?")

    def run_main(self, injured, previous=None):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "lines.json"
            if previous is not None:
                output.write_text(json.dumps(previous))
            page = lambda team: {"forwards": [["A"]], "defense": [], "goalies": [],
                                 "pp1": [], "pp2": [], "injured": injured, "abbr": "TST"}
            with patch.object(scraper, "OUTPUT_PATH", str(output)), \
                 patch.object(scraper, "TEAMS", ["test-team"]), \
                 patch.object(scraper, "scrape_team", side_effect=page), \
                 patch.object(scraper, "fill_positions"), \
                 patch.object(scraper.time, "sleep"), \
                 patch.object(scraper, "fetch_espn_team_ids",
                              side_effect=requests.HTTPError("403 Forbidden")) as espn:
                scraper.main()
            return json.loads(output.read_text()), espn

    def test_daily_faceoff_replaces_stale_espn_list_without_calling_espn(self):
        row = {"name": "BRAD MARCHAND", "pos": "LW", "status": "Out", "desc": ""}
        result, espn = self.run_main([row], {"injuries": {"anaheim-ducks": [{"name": "RADKO GUDAS"}]}})
        self.assertEqual(result["injuries"], {"test-team": [row]})
        self.assertEqual(result["injuries_meta"]["source"], "dailyfaceoff.com")
        self.assertEqual(result["injuries_meta"]["status"], "fresh")
        self.assertNotIn("injured", result["teams"]["test-team"])
        self.assertNotIn("abbr", result["teams"]["test-team"])
        espn.assert_not_called()

    def test_missing_daily_faceoff_data_falls_back_then_preserves(self):
        saved = {"test-team": [{"name": "INJURED PLAYER"}]}
        result, espn = self.run_main(None, {"injuries": saved, "injuries_meta": {
            "source": "dailyfaceoff.com", "updated_at": "2026-09-30"}})
        espn.assert_called_once()
        self.assertEqual(result["injuries"], saved)
        self.assertEqual(result["injuries_meta"]["status"], "stale")
        self.assertEqual(result["injuries_meta"]["source"], "dailyfaceoff.com")


if __name__ == "__main__":
    unittest.main()
