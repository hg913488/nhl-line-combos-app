import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayer, selectWatch, picksByIds, picksCaption, titleCase } from '../lib/og/picks-select.js';

const DATE = '2026-10-08';
const FUTURE = '2026-10-08T23:00:00Z';
let id = 0;
const player = (team, over = {}) => ({
  id: (id += 1),
  name: `PLAYER ${team}`,
  team,
  opp: 'OPP',
  game_id: 1,
  home: true,
  pos: 'C',
  line: 'L1',
  pp: 1,
  last10: { gp: 10, g: 4, a: 5, p: 9, sog: 30 },
  opp_index: 1.5,
  opp_goalie: { name: 'SOME GOALIE', status: 'Confirmed' },
  flags: ['PP1', 'HOT', 'SOFT_MATCHUP'],
  ...over,
});
const sheetOf = (players, games = [{ game_id: 1, start: FUTURE }]) => ({ date: DATE, games, players });

test('a PP1, hot, soft-matchup forward outscores a depth skater', () => {
  const star = player('AAA');
  const depth = player('BBB', { pp: null, line: 'L4', flags: [], last10: { gp: 10, g: 0, a: 1, p: 1, sog: 8 } });
  assert.ok(scorePlayer(star) > scorePlayer(depth) + 4);
});

test('one player per team, and no more than two from one game', () => {
  const players = [player('AAA'), player('AAA'), player('BBB'), player('CCC'), player('DDD')];
  const picked = selectWatch(sheetOf(players), { date: DATE, maxPerGame: 2, min: 1 });
  assert.equal(new Set(picked.map(p => p.team)).size, picked.length);
  assert.equal(picked.length, 2);          // all five share game 1
});

test('a sheet built for another day is stale and posts nothing', () => {
  const sheet = { ...sheetOf([player('AAA'), player('BBB'), player('CCC')]), date: '2026-10-07' };
  assert.deepEqual(selectWatch(sheet, { date: DATE }), []);
});

test('games already under way are left out', () => {
  const players = [player('AAA', { game_id: 1 }), player('BBB', { game_id: 2 }), player('CCC', { game_id: 3 }), player('DDD', { game_id: 4 })];
  const games = [
    { game_id: 1, start: '2026-10-08T17:00:00Z' },     // started
    { game_id: 2, start: FUTURE },
    { game_id: 3, start: FUTURE },
    { game_id: 4, start: FUTURE },
  ];
  const picked = selectWatch(sheetOf(players, games), { date: DATE, now: new Date('2026-10-08T18:00:00Z') });
  assert.deepEqual(picked.map(p => p.team).sort(), ['BBB', 'CCC', 'DDD']);
});

test('fewer than three worth featuring skips the post', () => {
  const players = [player('AAA', { game_id: 1 }), player('BBB', { game_id: 2 })];
  const games = [{ game_id: 1, start: FUTURE }, { game_id: 2, start: FUTURE }];
  assert.deepEqual(selectWatch(sheetOf(players, games), { date: DATE }), []);
});

test('reasons come only from fields that exist, and use no pronouns', () => {
  const bare = player('AAA', { flags: ['PP1'], last10: { gp: 0, g: 0, a: 0, p: 0, sog: 0 } });
  const [pick] = picksByIds(sheetOf([bare]), [bare.id]);
  assert.deepEqual(pick.clauses, ['On the first power-play unit']);
  const rich = picksByIds(sheetOf([player('BBB')]), [id])[0];
  assert.match(rich.clauses.join(' '), /OPP give up 50% more goals to centers than the league average/);
  assert.match(rich.clauses.join(' '), /9 points in the last 10 games/);
  assert.doesNotMatch(rich.clauses.join(' '), /\b(he|his|him|she|her|hers)\b/i);
});

test('a projected goalie is marked as such', () => {
  const p = player('AAA', { opp_goalie: { name: 'JANE ROE', status: 'Projected' } });
  const [pick] = picksByIds(sheetOf([p]), [p.id]);
  assert.deepEqual(pick.goalie, { name: 'Jane Roe', confirmed: false });
});

test('caption lists players with reasons, tags teams once, and avoids betting language', () => {
  const picked = selectWatch(sheetOf([player('AAA', { game_id: 1 }), player('BBB', { game_id: 2 }), player('CCC', { game_id: 3 })], [1, 2, 3].map(n => ({ game_id: n, start: FUTURE }))), { date: DATE });
  const caption = picksCaption(picked, DATE, 'example.test');
  assert.match(caption, /Players to watch tonight, Thursday, October 8/);
  assert.match(caption, /1\. Player \w+ \(\w+\):/);
  assert.ok(caption.length < 2200);
  assert.doesNotMatch(caption, /\b(bet|bets|betting|odds|parlay|pick'?em|picks?|props?|wager|lock|sportsbook)\b/i);
  assert.equal(caption.split('#OPP').length - 1, 1);
});

test('titleCase handles apostrophes and hyphens', () => {
  assert.equal(titleCase("JEAN-GABRIEL PAGEAU"), 'Jean-Gabriel Pageau');
  assert.equal(titleCase("RYAN O'REILLY"), "Ryan O'Reilly");
});
