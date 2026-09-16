import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from scraper import lineup_history


def team(forwards=None, defense=None, goalies=None, pp1=None, pp2=None):
    return {
        "forwards": forwards or [],
        "defense": defense or [],
        "goalies": goalies or [],
        "pp1": pp1 or [],
        "pp2": pp2 or [],
    }


def snapshot(updated_at, teams):
    return {"updated_at": updated_at, "teams": teams}


class GenerateEventsTests(unittest.TestCase):
    now = "2026-09-15 20:50:57 UTC"

    def test_combines_forward_and_power_play_promotion(self):
        previous = snapshot(self.now, {
            "alpha": team(
                forwards=[["ONE"], ["Jane Player"], ["THREE"]],
                goalies=[["GOALIE"]],
                pp2=["JANE PLAYER"],
            )
        })
        current = snapshot(self.now, {
            "alpha": team(
                forwards=[["JANE PLAYER"], ["ONE"], ["THREE"]],
                goalies=[["GOALIE"]],
                pp1=["Jane   Player"],
            )
        })

        events = lineup_history.generate_events(previous, current)
        event = next(event for event in events if event["player"] == "JANE PLAYER")
        self.assertEqual(event["event_types"], ["forward_line", "power_play"])
        self.assertEqual(event["before"]["forward_line"], 2)
        self.assertEqual(event["after"]["power_play"], 1)
        self.assertEqual([change.get("direction") for change in event["changes"]],
                         ["promoted", "promoted"])

    def test_defense_pair_demotion(self):
        previous = snapshot(self.now, {
            "alpha": team(defense=[["DEFENDER"], ["OTHER"]], goalies=[["G"]])
        })
        current = snapshot(self.now, {
            "alpha": team(defense=[["OTHER"], ["DEFENDER"]], goalies=[["G"]])
        })
        event = next(event for event in lineup_history.generate_events(previous, current)
                     if event["player"] == "DEFENDER")
        self.assertEqual(event["event_types"], ["defense_pair"])
        self.assertEqual(event["changes"][0]["direction"], "demoted")

    def test_team_change_includes_new_roles(self):
        previous = snapshot(self.now, {
            "alpha": team(forwards=[["TRADED PLAYER"], ["A"]], goalies=[["GA"]]),
            "beta": team(forwards=[["B"]], goalies=[["GB"]]),
        })
        current = snapshot(self.now, {
            "alpha": team(forwards=[["A"]], goalies=[["GA"]]),
            "beta": team(forwards=[["B"], ["TRADED PLAYER"]], goalies=[["GB"]],
                         pp1=["TRADED PLAYER"]),
        })
        event = next(event for event in lineup_history.generate_events(previous, current)
                     if event["player"] == "TRADED PLAYER")
        self.assertEqual(event["team"], "beta")
        self.assertEqual(event["previous_team"], "alpha")
        self.assertEqual(event["event_types"],
                         ["team", "forward_line", "power_play"])
        self.assertEqual(event["importance"], "high")

    def test_addition_and_removal(self):
        previous = snapshot(self.now, {
            "alpha": team(forwards=[["STAYS", "REMOVED"]], goalies=[["G"]])
        })
        current = snapshot(self.now, {
            "alpha": team(forwards=[["STAYS", "ADDED"]], goalies=[["G"]])
        })
        events = {event["player"]: event for event in
                  lineup_history.generate_events(previous, current)}
        self.assertEqual(events["ADDED"]["event_types"], ["addition"])
        self.assertFalse(events["ADDED"]["before"]["rostered"])
        self.assertEqual(events["REMOVED"]["event_types"], ["removal"])
        self.assertFalse(events["REMOVED"]["after"]["rostered"])

    def test_unchanged_snapshot_has_no_events(self):
        value = snapshot(self.now, {
            "alpha": team(forwards=[["SAME"]], goalies=[["G"]], pp1=["SAME"])
        })
        self.assertEqual(lineup_history.generate_events(value, value), [])

    def test_empty_team_is_treated_as_failed_scrape(self):
        previous = snapshot(self.now, {
            "alpha": team(forwards=[["PLAYER"]], goalies=[["G"]])
        })
        current = snapshot(self.now, {"alpha": team()})
        self.assertEqual(lineup_history.generate_events(previous, current), [])

    def test_ambiguous_duplicate_name_is_skipped(self):
        previous = snapshot(self.now, {
            "alpha": team(forwards=[["SAME NAME"]], goalies=[["A"]]),
            "beta": team(forwards=[["SAME NAME"]], goalies=[["B"]]),
        })
        current = snapshot(self.now, {
            "alpha": team(forwards=[["SAME NAME"]], goalies=[["A"]]),
            "beta": team(forwards=[["SAME NAME"]], goalies=[["B"]]),
        })
        self.assertEqual(lineup_history.generate_events(previous, current), [])

    def test_event_id_is_deterministic(self):
        previous = snapshot(self.now, {
            "alpha": team(forwards=[["PLAYER"], ["OTHER"]], goalies=[["G"]])
        })
        current = snapshot(self.now, {
            "alpha": team(forwards=[["OTHER"], ["PLAYER"]], goalies=[["G"]])
        })
        first = lineup_history.generate_events(previous, current)
        second = lineup_history.generate_events(previous, current)
        self.assertEqual(first, second)

    def test_missing_teams_object_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "teams"):
            lineup_history.generate_events({}, snapshot(self.now, {}))


class HistoryTests(unittest.TestCase):
    now = datetime(2026, 9, 15, 20, 50, 57, tzinfo=timezone.utc)

    @staticmethod
    def event(index, occurred_at):
        return {"id": f"event-{index:03}", "occurred_at": occurred_at}

    def test_history_deduplicates_prunes_and_caps(self):
        generated = self.now.isoformat().replace("+00:00", "Z")
        recent = generated
        old = (self.now - timedelta(days=91)).isoformat().replace("+00:00", "Z")
        existing = {"events": [self.event(1, recent), self.event(2, old)]}
        new_events = [self.event(1, recent)] + [
            self.event(index, recent) for index in range(3, 10)
        ]
        history = lineup_history.merge_history(
            existing, new_events, generated, max_age_days=90, max_events=5
        )
        self.assertEqual(history["schema_version"], 1)
        self.assertEqual(history["retention"], {"max_age_days": 90, "max_events": 5})
        self.assertEqual(len(history["events"]), 5)
        self.assertEqual(len({event["id"] for event in history["events"]}), 5)
        self.assertNotIn("event-002", {event["id"] for event in history["events"]})

    def test_build_history_writes_stable_top_level_schema(self):
        previous = snapshot("2026-09-15T19:00:00Z", {
            "alpha": team(forwards=[["PLAYER"], ["OTHER"]], goalies=[["G"]])
        })
        current = snapshot("2026-09-15T20:00:00Z", {
            "alpha": team(forwards=[["OTHER"], ["PLAYER"]], goalies=[["G"]])
        })
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_path, new_path = root / "old.json", root / "new.json"
            history_path = root / "nested" / "history.json"
            old_path.write_text(json.dumps(previous))
            new_path.write_text(json.dumps(current))
            result = lineup_history.build_history(old_path, new_path, history_path)
            saved = json.loads(history_path.read_text())
        self.assertEqual(saved, result)
        self.assertEqual(list(saved),
                         ["schema_version", "generated_at", "retention", "events"])
        self.assertEqual(saved["generated_at"], "2026-09-15T20:00:00Z")


if __name__ == "__main__":
    unittest.main()
