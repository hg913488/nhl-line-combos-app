import test from 'node:test';
import assert from 'node:assert/strict';
import { pickRecaps, pickRecap } from '../scripts/instagram-post.mjs';

const game = (id, away, home, { state = 'FINAL', lastPeriodType = 'REG' } = {}) => ({
  id,
  gameState: state,
  awayTeam: { abbrev: 'AAA', score: away },
  homeTeam: { abbrev: 'HHH', score: home },
  gameOutcome: { lastPeriodType },
});

test('picks the highest-scoring game first, then the closest', () => {
  const games = [
    game(1, 7, 5),                                   // 12 goals, margin 2
    game(2, 2, 1),                                   // 3 goals, margin 1
    game(3, 4, 0),                                   // 4 goals, margin 4
  ];
  const picked = pickRecaps(games, 2).map(g => g.id);
  assert.deepEqual(picked, [1, 2]);
});

test('an overtime finish counts as the closest game', () => {
  const games = [
    game(1, 8, 2),                                   // highest scoring
    game(2, 1, 0),                                   // regulation one-goal
    game(3, 3, 2, { lastPeriodType: 'OT' }),         // OT beats it on closeness
  ];
  const picked = pickRecaps(games, 2).map(g => g.id);
  assert.deepEqual(picked, [1, 3]);
});

test('never returns the same game twice when one game wins both criteria', () => {
  const games = [
    game(1, 5, 4, { lastPeriodType: 'OT' }),         // highest scoring AND closest
    game(2, 3, 1),
  ];
  const picked = pickRecaps(games, 2).map(g => g.id);
  assert.deepEqual(picked, [1, 2]);
  assert.equal(new Set(picked).size, 2);
});

test('ignores games that have not finished', () => {
  const games = [
    game(1, 9, 8, { state: 'LIVE' }),
    game(2, 2, 1),
  ];
  const picked = pickRecaps(games, 2).map(g => g.id);
  assert.deepEqual(picked, [2]);
});

test('returns what exists when the night is short', () => {
  assert.deepEqual(pickRecaps([], 2), []);
  assert.deepEqual(pickRecaps([game(1, 2, 1)], 2).map(g => g.id), [1]);
});

test('pickRecap still returns a single game, the highest scoring', () => {
  const games = [game(1, 2, 1), game(2, 6, 4)];
  assert.equal(pickRecap(games).id, 2);
  assert.equal(pickRecap([]), null);
});
