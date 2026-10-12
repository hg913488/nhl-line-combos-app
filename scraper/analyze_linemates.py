"""Offline all-strengths shared shift time; does not infer lines or 5v5 usage."""
import argparse
import gzip
import itertools
import json
import re
from collections import defaultdict
from pathlib import Path


def seconds(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d+:\d{2}', value):
        return None
    minute, second = map(int, value.split(':'))
    return minute * 60 + second if second < 60 else None


def merge(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def overlap(left, right):
    i = j = total = 0
    while i < len(left) and j < len(right):
        total += max(0, min(left[i][1], right[j][1]) - max(left[i][0], right[j][0]))
        if left[i][1] <= right[j][1]:
            i += 1
        else:
            j += 1
    return total


def boxscore_positions(boxscore):
    result = {}
    for side in ('awayTeam', 'homeTeam'):
        team = boxscore.get(side, {}).get('abbrev')
        for group, rows in boxscore.get('playerByGameStats', {}).get(side, {}).items():
            for row in rows:
                pos = 'G' if group == 'goalies' else row.get('position')
                if team and row.get('playerId') is not None and pos:
                    result[str(row['playerId'])] = {'position': pos, 'team': team}
    return result


def analyze(shifts, positions=None, boxscore=None, source=None):
    rows = shifts.get('data')
    if not isinstance(rows, list):
        raise ValueError('Shift payload must contain a data array')
    game_ids = {row.get('gameId') for row in rows if row.get('gameId') is not None}
    if len(game_ids) > 1:
        raise ValueError('Supply one game at a time')
    if boxscore and game_ids and boxscore.get('id') not in game_ids:
        raise ValueError('Boxscore game does not match shift game')
    known = boxscore_positions(boxscore or {})
    known.update({str(k): v for k, v in (positions or {}).items()})
    if not known:
        raise ValueError('Verified player positions are required to exclude goalies')
    intervals = defaultdict(list)
    names = {}
    unknown = set()
    invalid = 0
    for row in rows:
        # 517 = shift; event markers and zero-duration records are not intervals.
        if row.get('typeCode') != 517:
            continue
        player = str(row.get('playerId'))
        info = known.get(player)
        position = info.get('position') if isinstance(info, dict) else info
        if position not in {'C', 'L', 'R', 'LW', 'RW', 'F', 'D', 'G'}:
            unknown.add(player)
            continue
        if position == 'G':
            continue
        start, end = seconds(row.get('startTime')), seconds(row.get('endTime'))
        team, period = row.get('teamAbbrev'), row.get('period')
        if (start is None or end is None or end <= start or not team
                or not isinstance(period, int) or isinstance(period, bool) or period < 1
                or (isinstance(info, dict) and info.get('team') not in (None, team))):
            invalid += 1
            continue
        intervals[(team, player, period)].append((start, end))
        names[player] = ' '.join(str(row.get(k) or '') for k in ('firstName', 'lastName')).strip()
    merged = {key: merge(value) for key, value in intervals.items()}
    players = defaultdict(set)
    for team, player, period in merged:
        players[team].add(player)
    pairs = []
    for team, ids in players.items():
        periods = sorted({period for t, _, period in merged if t == team})
        for a, b in itertools.combinations(sorted(ids), 2):
            by_period = {str(period): overlap(merged.get((team, a, period), []), merged.get((team, b, period), [])) for period in periods}
            total = sum(by_period.values())
            if total:
                pairs.append({'team': team, 'playerIds': [a, b], 'playerNames': [names[a], names[b]],
                              'sharedSeconds': total, 'sharedMinutes': round(total / 60, 3), 'byPeriodSeconds': by_period})
    return {'gameId': next(iter(game_ids), None), 'strength': 'all-strengths', 'source': source,
            'sample': {'games': 1 if rows else 0, 'shiftRows': len(rows), 'skatersWithIntervals': len({(t, p) for t, p, _ in merged}),
                       'unknownPositionPlayerIds': sorted(unknown), 'invalidShiftRows': invalid,
                       'positionSource': 'boxscore and/or supplied verified positions'},
            'caution': 'Shared shift time is on-ice overlap, not a confirmed line. Includes every strength and overtime; not 5v5. Unknown-position players are excluded. Shift gaps/corrections can undercount; pair totals overlap and must not be summed as team ice time.',
            'pairs': sorted(pairs, key=lambda pair: (-pair['sharedSeconds'], pair['team'], pair['playerIds']))}


def load(path):
    path = Path(path)
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt') as handle:
        return json.load(handle)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('shifts', help='Shift JSON or JSON.gz for one game')
    parser.add_argument('--boxscore', help='Matching NHL boxscore JSON or JSON.gz')
    parser.add_argument('--positions', help='Verified player ID to position (or position/team object) JSON')
    parser.add_argument('--output', help='Output JSON path; defaults to stdout')
    args = parser.parse_args()
    try:
        result = analyze(load(args.shifts), load(args.positions) if args.positions else None,
                         load(args.boxscore) if args.boxscore else None, {'shifts': args.shifts, 'boxscore': args.boxscore, 'positions': args.positions})
    except (ValueError, OSError) as error:
        parser.error(str(error))
    text = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(text)
    else:
        print(text, end='')


if __name__ == '__main__':
    main()
