import unittest
from datetime import datetime, timezone

from scraper import build_spotlight as sp

NOW = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)


def row(player_id, day, goals=0, assists=0, shots=2, toi=1080, **extra):
    return {
        "playerId": player_id, "skaterFullName": extra.pop("name", f"Player {player_id}"),
        "teamAbbrev": extra.pop("team", "TOR"), "positionCode": extra.pop("pos", "C"),
        "gameId": 2026020000 + day, "gameDate": f"2026-11-{day:02d}",
        "goals": goals, "assists": assists, "points": goals + assists, "shots": shots,
        "ppPoints": extra.pop("pp", 0), "timeOnIcePerGame": toi,
    }


class SummaryTests(unittest.TestCase):
    def test_summarize_rates_and_shooting(self):
        summary = sp.summarize([row(1, 1, goals=1, shots=4, toi=1200), row(1, 2, assists=2, shots=6, toi=1000)])
        self.assertEqual(summary["p"], 3)
        self.assertEqual(summary["p_pg"], 1.5)
        self.assertEqual(summary["sog_pg"], 5.0)
        self.assertEqual(summary["toi"], 1100)
        self.assertEqual(summary["sh_pct"], 10.0)
        self.assertIsNone(sp.summarize([row(1, 1, shots=0)])["sh_pct"])
        self.assertIsNone(sp.summarize([])["p_pg"])

    def test_streaks_and_droughts_count_from_newest_game(self):
        games = [row(1, 10, goals=1), row(1, 9, assists=1), row(1, 8, goals=1), row(1, 7)]
        entry = sp.player_entry(games)
        self.assertEqual(entry["pointStreak"], 3)
        self.assertEqual(entry["goalStreak"], 1)
        self.assertEqual(entry["pointDrought"], 0)
        cold = sp.player_entry([row(2, 10), row(2, 9), row(2, 8, goals=1)])
        self.assertEqual(cold["pointDrought"], 2)
        self.assertEqual(cold["goalDrought"], 2)


class MomentumTests(unittest.TestCase):
    def test_momentum_needs_a_season_sample(self):
        few = [row(1, day) for day in range(1, 6)]
        self.assertIsNone(sp.player_entry(few)["momentum"])

    def test_momentum_weights_points_shots_and_toi(self):
        # 10 quiet games, then 5 hot ones (newest first after build_players sorts).
        rows = [row(1, day) for day in range(1, 11)]
        rows += [row(1, day, goals=1, shots=4, toi=1200) for day in range(11, 16)]
        player = sp.build_players(rows)[0]
        season, recent = player["season"], player["last5"]
        expected = round((recent["p_pg"] - season["p_pg"])
                         + 0.25 * (recent["sog_pg"] - season["sog_pg"])
                         + 0.10 * (recent["toi"] - season["toi"]) / 60, 2)
        self.assertEqual(player["momentum"], expected)
        self.assertGreater(player["momentum"], 0)

    def test_early_season_flag_until_ten_games(self):
        early = sp.build_document([row(1, 1), row(2, 1)], None, 20262027, NOW)
        self.assertTrue(early["earlySeason"])
        late = sp.build_document([row(1, day) for day in range(1, 11)], None, 20262027, NOW)
        self.assertFalse(late["earlySeason"])
        self.assertEqual(late["season"], "2026-27")


class RoleChangeTests(unittest.TestCase):
    def test_direction(self):
        self.assertEqual(sp.move_direction({"type": "forward_line", "from": 3, "to": 1}), "up")
        self.assertEqual(sp.move_direction({"type": "defense_pair", "from": 1, "to": 2}), "down")
        self.assertEqual(sp.move_direction({"type": "power_play", "from": None, "to": 2}), "up")
        self.assertEqual(sp.move_direction({"type": "power_play", "from": 1, "to": None}), "down")
        self.assertIsNone(sp.move_direction({"type": "addition", "from": None, "to": None}))

    def test_role_changes_window_dedupe_and_ids(self):
        players = [sp.player_entry([row(7, 1, name="Émile Test")])]
        changes = {"events": [
            {"player": "EMILE TEST", "team": "toronto-maple-leafs", "occurred_at": "2026-11-19T10:00:00Z",
             "changes": [{"type": "forward_line", "from": 2, "to": 1}]},
            {"player": "EMILE TEST", "team": "toronto-maple-leafs", "occurred_at": "2026-11-18T10:00:00Z",
             "changes": [{"type": "forward_line", "from": 1, "to": 2}]},
            {"player": "OLD NEWS", "team": "boston-bruins", "occurred_at": "2026-11-01T10:00:00Z",
             "changes": [{"type": "forward_line", "from": 2, "to": 1}]},
            {"player": "NEW GUY", "team": "boston-bruins", "occurred_at": "2026-11-19T10:00:00Z",
             "changes": [{"type": "addition", "from": None, "to": None}]},
        ]}
        out = sp.role_changes(changes, players, NOW)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["id"], 7)
        self.assertEqual(out[0]["direction"], "up")
        self.assertEqual(sp.role_changes(None, players, NOW), [])


if __name__ == "__main__":
    unittest.main()
