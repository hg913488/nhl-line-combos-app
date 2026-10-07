import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePlayer, selectWatch, picksByIds, picksCaption, titleCase, selectRisers, latestPromotion, risersCaption } from '../lib/og/picks-select.js';

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
  assert.match(caption, /(Players to watch tonight|Who to watch tonight|Tonight's players to watch), Thursday, October 8/);
  assert.match(caption, /1\. Player \w+ \(\w+\):/);
  assert.ok(caption.length < 2200);
  assert.doesNotMatch(caption, /\b(bet|bets|betting|odds|parlay|pick'?em|picks?|props?|wager|lock|sportsbook)\b/i);
  assert.equal(caption.split('#OPP').length - 1, 1);
});

test('titleCase handles apostrophes and hyphens', () => {
  assert.equal(titleCase("JEAN-GABRIEL PAGEAU"), 'Jean-Gabriel Pageau');
  assert.equal(titleCase("RYAN O'REILLY"), "Ryan O'Reilly");
});

// --- Moving up ---

const NOW = new Date('2026-10-08T16:00:00Z');
const SLUG = { ANA: 'anaheim-ducks', BOS: 'boston-bruins', BUF: 'buffalo-sabres', CGY: 'calgary-flames' };
const event = (team, name, change, hoursAgo = 5) => ({
  team: SLUG[team], player: name, occurred_at: new Date(NOW.getTime() - hoursAgo * 3600000).toISOString(), changes: [change],
});
const promoted = (type, from, to) => ({ type, from, to, direction: 'promoted' });
const riser = (team, over = {}) => player(team, { name: `RISER ${team}`, flags: ['ROLE_UP'], pp: null, line: 'L1', ...over });
const TEAM_CODES = ['ANA', 'BOS', 'BUF', 'CGY'];

test('latestPromotion picks the biggest recent promotion and ignores demotions, old moves and bottom-line shuffles', () => {
  const changes = { events: [
    event('ANA', 'RISER ANA', promoted('forward_line', 4, 1)),
    event('ANA', 'RISER ANA', { type: 'forward_line', from: 1, to: 4, direction: 'demoted' }, 2),
    event('BOS', 'RISER BOS', promoted('forward_line', 4, 3)),           // bottom-six shuffle: not notable
    event('BUF', 'RISER BUF', promoted('forward_line', 4, 1), 60),       // outside 48 h
  ] };
  const move = latestPromotion(changes, { team: 'ANA', name: 'riser ana', now: NOW });
  assert.deepEqual([move.type, move.from, move.to, move.jump, move.hoursAgo], ['forward_line', 4, 1, 3, 5]);
  assert.equal(latestPromotion(changes, { team: 'BOS', name: 'RISER BOS', now: NOW }), null);
  assert.equal(latestPromotion(changes, { team: 'BUF', name: 'RISER BUF', now: NOW }), null);
});

test('a newly gained PP1 slot counts, and reads as an addition', () => {
  const changes = { events: [event('ANA', 'RISER ANA', { type: 'power_play', from: null, to: 1, direction: 'promoted' })] };
  const move = latestPromotion(changes, { team: 'ANA', name: 'RISER ANA', now: NOW });
  assert.equal(move.jump, 3);
});

test('selectRisers needs ROLE_UP, a notable promotion and a game that has not started', () => {
  const players = [riser('ANA'), riser('BOS', { game_id: 2 }), riser('BUF', { flags: [] }), riser('CGY', { game_id: 3 })];
  const changes = { events: TEAM_CODES.map(team => event(team, `RISER ${team}`, promoted('forward_line', 4, 1))) };
  const games = [
    { game_id: 1, start: FUTURE }, { game_id: 2, start: FUTURE }, { game_id: 3, start: '2026-10-08T15:00:00Z' },   // game 3 already started
  ];
  const picked = selectRisers(sheetOf(players, games), changes, { date: DATE, now: NOW, min: 1 });
  assert.deepEqual(picked.map(p => p.team).sort(), ['ANA', 'BOS']);          // BUF lacks the flag, CGY's game is under way
  assert.match(picked[0].clauses[0], /Moved up from line 4 to line 1, 5 hours ago/);
  assert.ok(picked.every(p => !p.clauses.some(c => /^Recently moved up/.test(c))), 'the generic flag clause is replaced by the real move');
});

test('selectRisers keeps one per team, honours exclude, and skips below the minimum', () => {
  const players = [riser('ANA'), riser('ANA', { name: 'RISER ANA' }), riser('BOS'), riser('BUF')];
  const changes = { events: ['ANA', 'BOS', 'BUF'].map(team => event(team, `RISER ${team}`, promoted('forward_line', 4, 1))) };
  const sheet = sheetOf(players, [{ game_id: 1, start: FUTURE }]);
  const all = selectRisers(sheet, changes, { date: DATE, now: NOW, min: 1, maxPerGame: 5 });
  assert.equal(new Set(all.map(p => p.team)).size, all.length);
  const without = selectRisers(sheet, changes, { date: DATE, now: NOW, min: 1, maxPerGame: 5, exclude: [players[2].id] });
  assert.ok(!without.some(p => p.team === 'BOS'));
  assert.deepEqual(selectRisers(sheet, changes, { date: DATE, now: NOW, min: 5 }), []);                       // too thin: skip
  assert.deepEqual(selectRisers({ ...sheet, date: '2026-10-07' }, changes, { date: DATE, now: NOW, min: 1 }), []); // stale sheet
});

test('the risers caption names players and the move, tags teams once and avoids betting language', () => {
  const changes = { events: ['ANA', 'BOS', 'BUF'].map(team => event(team, `RISER ${team}`, promoted('forward_line', 3, 1))) };
  const picked = selectRisers(sheetOf([riser('ANA'), riser('BOS', { game_id: 2 }), riser('BUF', { game_id: 3 })], [1, 2, 3].map(game_id => ({ game_id, start: FUTURE }))), changes, { date: DATE, now: NOW });
  const caption = risersCaption(picked, DATE, 'example.test');
  assert.match(caption, /(Moving up the lineup|Promoted in the last 48 hours|Lineup risers tonight), Thursday, October 8\./);
  assert.match(caption, /Moved up from line 3 to line 1/);
  assert.ok(caption.length < 2200);
  assert.doesNotMatch(caption, /\b(bet|odds|parlay|wager)\b/i);
});
