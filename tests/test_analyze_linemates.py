import unittest
from scraper.analyze_linemates import analyze, boxscore_positions


def shift(player, start, end, period=1, team='VAN', **extra):
    return dict(playerId=player, gameId=1, teamAbbrev=team, period=period,
                startTime=start, endTime=end, typeCode=517, **extra)


class LinematesTests(unittest.TestCase):
    def test_merges_duplicates_and_keeps_periods_separate(self):
        rows = [shift(1, '00:00', '01:00'), shift(1, '00:30', '01:30'),
                shift(1, '00:00', '01:00'), shift(2, '00:30', '02:00'),
                shift(1, '00:00', '01:00', 2), shift(2, '00:00', '00:30', 2),
                shift(3, '00:00', '20:00'), shift(4, '00:00', '02:00', team='SEA')]
        result = analyze({'data': rows}, {1: 'D', 2: 'C', 3: 'G', 4: 'D'})
        self.assertEqual(len(result['pairs']), 1)
        self.assertEqual(result['pairs'][0]['sharedSeconds'], 90)
        self.assertEqual(result['pairs'][0]['byPeriodSeconds'], {'1': 60, '2': 30})
        self.assertEqual(result['strength'], 'all-strengths')

    def test_unknown_and_invalid_are_reported(self):
        rows = [shift(1, '00:00', '00:30'), shift(2, '00:00', '00:30'),
                shift(1, '00:99', '01:00'), shift(1, '01:00', '00:00')]
        result = analyze({'data': rows}, {1: 'C'})
        self.assertEqual(result['sample']['unknownPositionPlayerIds'], ['2'])
        self.assertEqual(result['sample']['invalidShiftRows'], 2)
        self.assertEqual(result['pairs'], [])
        with self.assertRaises(ValueError):
            analyze({'data': rows})

    def test_boxscore_excludes_goalies_and_validates_game(self):
        box = {'id': 1, 'awayTeam': {'abbrev': 'VAN'}, 'playerByGameStats': {
            'awayTeam': {'forwards': [{'playerId': 1, 'position': 'C'}],
                         'goalies': [{'playerId': 2}]}}}
        self.assertEqual(boxscore_positions(box)['2']['position'], 'G')
        self.assertEqual(analyze({'data': [shift(1, '00:00', '01:00'), shift(2, '00:00', '01:00')]}, boxscore=box)['pairs'], [])
        box['id'] = 2
        with self.assertRaises(ValueError):
            analyze({'data': [shift(1, '00:00', '01:00')]}, boxscore=box)

    def test_touching_shifts_do_not_overlap_and_team_mismatch_is_invalid(self):
        rows = [shift(1, '00:00', '00:30'), shift(2, '00:30', '01:00')]
        self.assertEqual(analyze({'data': rows}, {1: 'D', 2: 'D'})['pairs'], [])
        result = analyze({'data': rows}, {1: {'position': 'D', 'team': 'SEA'}, 2: 'D'})
        self.assertEqual(result['sample']['invalidShiftRows'], 1)


if __name__ == '__main__':
    unittest.main()
