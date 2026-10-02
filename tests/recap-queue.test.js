import test from 'node:test';
import assert from 'node:assert/strict';
import { claimRecaps, qualifies, scoreboardDue, scoreboardPages, scoreboardCaption, shiftDate, recapSlots } from '../scripts/lib/recap-queue.mjs';

let n = 0;
const game = (away, home, { state = 'FINAL', period = 'REG', start } = {}) => {
  n += 1;
  return {
    id: 2026020000 + n,
    gameState: state,
    startTimeUTC: start || `2026-09-26T${String(18 + (n % 6)).padStart(2, '0')}:00:00Z`,
    awayTeam: { abbrev: `A${n}`, score: away },
    homeTeam: { abbrev: `H${n}`, score: home },
    gameOutcome: { lastPeriodType: period },
  };
};

test('claims games that earned a slot in the order they started', () => {
  const games = [game(2, 1), game(5, 1), game(3, 2, { period: 'OT' })];
  const claimed = claimRecaps({ games });
  assert.equal(claimed.length, 3);
  assert.deepEqual(claimed.map(g => g.id), [...games].sort((a, b) => a.startTimeUTC.localeCompare(b.startTimeUTC) || a.id - b.id).map(g => g.id));
});

test('a plain 3-1 game does not earn a slot', () => {
  assert.equal(qualifies(game(3, 1), 0), false);
  assert.equal(qualifies(game(2, 1), 0), true);       // one-goal
  assert.equal(qualifies(game(6, 1), 0), true);       // margin 5
  assert.equal(qualifies(game(5, 3), 0), true);       // 8 goals
});

test('never more than four recaps a night, however many runs or games', () => {
  const games = Array.from({ length: 14 }, (_, i) => game(i % 2 ? 1 : 2, 1, { start: `2026-09-26T${String(17 + Math.floor(i / 2)).padStart(2, '0')}:00:00Z` }));
  const posted = new Set();
  let used = 0;
  // Games go final a few at a time; each "run" sees more finished games than the last.
  for (const visible of [3, 6, 10, 14]) {
    const seen = games.map((g, i) => ({ ...g, gameState: i < visible ? 'FINAL' : 'LIVE' }));
    for (const g of claimRecaps({ games: seen, recapped: posted, used })) { posted.add(String(g.id)); used += 1; }
  }
  assert.ok(used <= 4, `posted ${used}`);
  assert.ok(posted.size === used);
});

test('a rerun with the same games claims nothing new', () => {
  const games = [game(2, 1), game(5, 1), game(4, 3, { period: 'SO' })];
  const first = claimRecaps({ games });
  const recapped = new Set(first.map(g => String(g.id)));
  assert.deepEqual(claimRecaps({ games, recapped, used: first.length }), []);
});

test('the last slot is held for overtime or a track meet', () => {
  assert.equal(qualifies(game(2, 1), 3), false);
  assert.equal(qualifies(game(3, 2, { period: 'OT' }), 3), true);
  assert.equal(qualifies(game(6, 4), 3), true);        // 10 goals
  assert.equal(qualifies(game(2, 1, { period: 'OT' }), 4), false);   // no slot left
});

test('games still in progress are never recapped', () => {
  assert.deepEqual(claimRecaps({ games: [game(5, 4, { state: 'LIVE' })] }), []);
});

test('slot count comes from IG_RECAP_SLOTS, defaulting to four', () => {
  assert.equal(recapSlots(undefined), 4);
  assert.equal(recapSlots('6'), 6);
  assert.equal(recapSlots('nonsense'), 4);
});

test('the scoreboard waits for the whole night, then for 9 AM ET', () => {
  const done = game(2, 1);
  const live = game(1, 0, { state: 'LIVE' });
  const evening = new Date('2026-09-27T02:00:00Z');          // 10 PM ET on 9-26
  const nextEight = new Date('2026-09-27T12:00:00Z');        // 8 AM ET on 9-27
  const nextTen = new Date('2026-09-27T14:00:00Z');          // 10 AM ET on 9-27
  assert.equal(scoreboardDue({ games: [done, done], date: '2026-09-26', now: evening }), true);
  assert.equal(scoreboardDue({ games: [done, live], date: '2026-09-26', now: evening }), false);
  assert.equal(scoreboardDue({ games: [done, live], date: '2026-09-26', now: nextEight }), false);
  assert.equal(scoreboardDue({ games: [done, live], date: '2026-09-26', now: nextTen }), true);
  assert.equal(scoreboardDue({ games: [live], date: '2026-09-26', now: nextTen }), false);   // nothing to show
});

test('scoreboard slide count: eight a slide', () => {
  assert.deepEqual([1, 8, 9, 14, 16, 17].map(scoreboardPages), [1, 1, 2, 2, 2, 3]);
});

test('scoreboard caption lists results, tags teams once, and avoids betting language', () => {
  const games = [game(6, 0), game(2, 3, { period: 'OT' })];
  const caption = scoreboardCaption(games, '2026-09-26', 'example.test');
  assert.match(caption, /Saturday, September 26: 2 finals/);
  assert.match(caption, /\(OT\)/);
  assert.ok(caption.length < 2200);
  assert.doesNotMatch(caption, /\b(bet|odds|parlay|pick'?em|wager)\b/i);
  const abbr = games[0].awayTeam.abbrev;
  assert.equal(caption.split(`#${abbr}`).length - 1, 1);
});

test('shiftDate crosses month ends', () => {
  assert.equal(shiftDate('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDate('2026-09-30', 1), '2026-10-01');
});
