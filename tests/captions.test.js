import test from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, picksHook, risersHook, recapHook, scoreboardHook, slateHook, slateOpener } from '../lib/captions/hooks.js';
import { recapCaption, buildCaption } from '../scripts/instagram-post.mjs';
import { scoreboardCaption } from '../scripts/lib/recap-queue.mjs';

const BANNED = /\b(bet|bets|betting|odds|parlay|pick'?em|picks?|props?|wager|lock|sportsbook)\b/i;
const game = (away, home, a, h, period = 'REG', id = 1) => ({
  id, gameState: 'FINAL', awayTeam: { abbrev: away, score: a }, homeTeam: { abbrev: home, score: h }, gameOutcome: { lastPeriodType: period },
});
const dates = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

test('hashSeed is stable', () => {
  assert.equal(hashSeed('picks:2026-10-08'), hashSeed('picks:2026-10-08'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('same input gives the same caption', () => {
  const g = game('WPG', 'PIT', 2, 3, 'OT', 77);
  assert.equal(recapCaption(g), recapCaption(g));
  const games = [{ away: 'TOR', home: 'MTL' }, { away: 'BOS', home: 'NYR' }];
  assert.equal(buildCaption(games, '2026-10-08'), buildCaption(games, '2026-10-08'));
});

test('recap hook reflects the game', () => {
  assert.equal(recapHook(game('A', 'B', 2, 3, 'SO')), 'It took a shootout.');
  assert.equal(recapHook(game('A', 'B', 2, 3, 'OT')), 'It needed overtime.');
  assert.equal(recapHook(game('A', 'B', 1, 2)), 'A one-goal game in regulation.');
  assert.equal(recapHook(game('A', 'B', 2, 3, 'OT'), '').includes('shootout'), false);
  assert.equal(recapHook(game('A', 'B', 3, 5, 'REG')), null);
});

test('recapCaption keeps the score line and tags both teams', () => {
  const caption = recapCaption(game('WPG', 'PIT', 2, 3, 'OT'));
  assert.match(caption, /^PIT 3, WPG 2 \(OT\)\.\nIt needed overtime\./);
  assert.match(caption, /#PIT #WPG$/);
  assert.doesNotMatch(caption, BANNED);
});

test('slate opener and hook rotate across dates and stay clean', () => {
  const games = [{ away: 'TOR', home: 'MTL' }];
  const openers = new Set(dates.map(d => slateOpener(games, d)));
  assert.ok(openers.size > 1);
  assert.match(slateHook(games, '2026-10-08'), /TOR and MTL meet tonight|quiet night/);
  for (const d of dates) {
    const caption = buildCaption(games, d);
    assert.ok(caption.length < 2200);
    assert.doesNotMatch(caption, BANNED);
    assert.equal(caption.split('#TOR').length - 1, 1);
  }
});

test('scoreboard hook reads the finals', () => {
  const finals = [game('A', 'B', 2, 3, 'OT'), game('C', 'D', 0, 4)];
  const picked = new Set(dates.map(d => scoreboardHook(finals, d)));
  for (const hook of picked) assert.match(hook, /past 60 minutes|shutout/);
  assert.equal(scoreboardHook([game('A', 'B', 1, 4)], '2026-10-08'), null);
  const caption = scoreboardCaption(finals, '2026-10-08', 'example.test');
  assert.doesNotMatch(caption, BANNED);
  assert.ok(caption.length < 2200);
});

const pickRow = (over = {}) => ({ display: 'Player One', team: 'AAA', opp: 'BBB', pos: 'C', oppIndex: 1.4, last10: { gp: 10, p: 9 }, goalie: { name: 'G', confirmed: false }, clauses: ['x'], ...over });

test('picks hook uses the data and avoids pronouns and wagering words', () => {
  const seen = new Set(dates.map(d => picksHook([pickRow()], d)));
  for (const hook of seen) {
    assert.match(hook, /Softest matchup|Hottest on the list|unconfirmed/);
    assert.doesNotMatch(hook, BANNED);
    assert.doesNotMatch(hook, /\b(he|she|his|her|him)\b/i);
  }
  assert.ok(seen.size > 1);
  assert.equal(picksHook([pickRow({ oppIndex: 1, last10: undefined, goalie: null })], '2026-10-08'), null);
});

test('risers hook only claims a jump the data supports', () => {
  const jumper = { display: 'Riser', team: 'AAA', move: { type: 'forward_line', from: 3, to: 1, jump: 2 } };
  const entered = { display: 'New', team: 'BBB', move: { type: 'forward_line', from: null, to: 1, jump: 2 } };
  for (const d of dates) assert.doesNotMatch(risersHook([entered], d) || '', /Biggest jump/);
  const hooks = new Set(dates.map(d => risersHook([jumper], d)));
  assert.ok([...hooks].some(h => /Biggest jump: Riser \(AAA\) moved up 2 spots/.test(h)));
});
